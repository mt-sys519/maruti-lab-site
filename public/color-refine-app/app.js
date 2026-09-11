let session = null;

document.addEventListener("DOMContentLoaded", () => {
    const fileInput = document.getElementById("imageUpload");
    const uploadArea = document.getElementById("upload-area");
    const uploadPrivacyPromise = document.getElementById("upload-privacy-promise");
    const preview = document.getElementById("preview");
    const colorizeButton = document.getElementById("colorize");
    const statusMessage = document.getElementById("status-message");
    const loadingOverlay = document.getElementById("loading-overlay");
    const loadingTitle = document.getElementById("loading-title");
    const loadingDetail = document.getElementById("loading-detail");
    const loadingProgress = document.querySelector(".loading-progress");
    const loadingProgressBar = document.getElementById("loading-progress-bar");
    const loadingPercent = document.getElementById("loading-percent");
    const previewActions = document.getElementById("preview-actions");
    const removeImageButton = document.getElementById("remove-image");
    const deleteModelCacheButton = document.getElementById("delete-model-cache");

    const MODEL_CACHE_NAME = "color-refine-ai-model-v2-3-1";
    const ORT_CDN_BASE = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/";
    const userAgent = navigator.userAgent || "";
    const platform = navigator.platform || "";
    const touchPoints = navigator.maxTouchPoints || 0;
    const isAppleMobile = /iPhone|iPad|iPod/.test(userAgent) ||
        (platform === "MacIntel" && touchPoints > 1);

    // metadata.jsonで確認できたQualcomm版DDColorの固定入力サイズ。
    const MODEL_WIDTH = 256;
    const MODEL_HEIGHT = 256;

    // DDColor公式処理は、モデル出力のabをそのまま元画像のLへ合成する。
    // COLOR RE:FINEでは色味を3段階から選べる。
    const COLOR_PRESETS = {
        official: {
            label: "Standard",
            aStrength: 1,
            bStrength: 1,
            softLimit: Infinity,
            compression: 1
        },
        natural: {
            label: "Natural",
            aStrength: 0.72,
            bStrength: 0.88,
            softLimit: 62,
            compression: 0.32
        },
        soft: {
            label: "Soft",
            aStrength: 0.60,
            bStrength: 0.78,
            softLimit: 54,
            compression: 0.26
        }
    };

    let originalImage = null;
    let originalImageElement = null;
    let resultObjectUrl = null;
    let resultBlob = null;
    let dragCounter = 0;

    // 推論結果を保持し、色味変更時はAI推論をやり直さない。
    let lastOutputAb = null;
    let lastOutputDims = null;
    let currentColorPreset = "natural";
    let referenceStats = null;
    let referenceStrength = 50;
    let referenceEnabled = false;
    let referenceFileName = "";
    let isRenderingColor = false;

    // 色味を変更して再描画しても、現在の表示状態を維持する。
    let currentViewMode = "compare";
    let currentComparisonPercent = 50;

    const aiCanvas = document.createElement("canvas");
    const aiContext = aiCanvas.getContext("2d", {
        willReadFrequently: true
    });

    const sourceCanvas = document.createElement("canvas");
    const sourceContext = sourceCanvas.getContext("2d", {
        willReadFrequently: true
    });

    const outputCanvas = document.createElement("canvas");
    const outputContext = outputCanvas.getContext("2d");

    // AI処理を始める前に、古いSafariや必要機能がない環境を判定する。
    const compatibility = checkAiCompatibility();
    if (!compatibility.supported) {
        showCompatibilityNotice(compatibility);
        return;
    }

    if (!aiContext || !sourceContext || !outputContext) {
        statusMessage.textContent =
            "このブラウザでは画像処理用Canvasを利用できません。";
        colorizeButton.disabled = true;
        return;
    }

    function checkAiCompatibility() {
        const versionMatch = userAgent.match(/OS (\d+)[._](\d+)?/);
        const iosMajor = versionMatch ? Number(versionMatch[1]) : null;

        if (isAppleMobile && iosMajor !== null && iosMajor < 16) {
            return {
                supported: false,
                title: "このiPhone・iPadではAIカラー化を利用できません",
                message: `この端末のiOS ${iosMajor}は、AI処理に必要なブラウザ機能へ対応していません。iOS 16以降の端末、または最新版のChrome／Edgeを使用できるPCでお試しください。`,
                reason: "old-ios"
            };
        }

        if (typeof WebAssembly !== "object") {
            return {
                supported: false,
                title: "このブラウザではAIカラー化を利用できません",
                message: "AI処理に必要なWebAssemblyへ対応していません。OSとブラウザを更新するか、最新版のChrome、Edge、Safariでお試しください。",
                reason: "no-webassembly"
            };
        }

        if (!window.ort || !window.ort.InferenceSession) {
            return {
                supported: false,
                title: "AI実行機能を読み込めませんでした",
                message: "通信状態を確認してページを再読み込みしてください。改善しない場合は、広告ブロックやコンテンツブロッカーを一時的に無効にするか、別の最新ブラウザでお試しください。",
                reason: "runtime-load-failed"
            };
        }

        return { supported: true };
    }

    function showCompatibilityNotice(result) {
        const notice = document.createElement("section");
        notice.className = "compatibility-notice";
        notice.setAttribute("role", "alert");
        notice.innerHTML = `
            <p class="compatibility-kicker">UNSUPPORTED ENVIRONMENT</p>
            <h2>${result.title}</h2>
            <p>${result.message}</p>
            <p class="compatibility-help"><a href="help.html#supported-environment">対応環境と対処方法を見る</a></p>
        `;

        uploadArea.before(notice);
        uploadArea.classList.add("is-disabled");
        uploadArea.setAttribute("aria-disabled", "true");
        fileInput.disabled = true;
        colorizeButton.disabled = true;
        statusMessage.textContent = "この環境ではAIカラー化を開始できません。";
    }

    // iPhone / Safariを含め、WASMの読み込み先とスレッド数を固定する。
    if (window.ort && window.ort.env && window.ort.env.wasm) {
        window.ort.env.wasm.wasmPaths = ORT_CDN_BASE;
        window.ort.env.wasm.numThreads = 1;

        // 古いiOS SafariではSIMD版WASMを読み込めない場合がある。
        if (/iP(?:hone|ad|od)/.test(navigator.userAgent)) {
            try {
                window.ort.env.wasm.simd = false;
            } catch (error) {
                console.info("SIMD設定はこのONNX Runtimeでは変更できません。", error);
            }
        }
    }

    if (removeImageButton) removeImageButton.addEventListener("click", () => {
        clearLoadedImage();
        colorizeButton.disabled = true;
        statusMessage.textContent = "選択した写真を削除しました。";
        uploadArea.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    if (deleteModelCacheButton) deleteModelCacheButton.addEventListener("click", deleteStoredModel);

    // --------------------------------
    // ファイル選択
    // --------------------------------
    function initializeSampleComparison() {
        const sample = document.getElementById("sample-comparison");

        if (!sample) {
            return;
        }

        const colorLayer = sample.querySelector(".sample-color-layer");
        const divider = sample.querySelector(".sample-comparison-divider");
        const handle = sample.querySelector(".sample-comparison-handle");
        let position = Number(sample.dataset.start || 64);
        let isDragging = false;
        let demoFrame = 0;
        let demoTimer = 0;
        let demoCancelled = false;

        const setPosition = (value) => {
            position = Math.max(0, Math.min(100, Number(value)));
            colorLayer.style.clipPath = `polygon(0 0, ${position}% 0, ${position}% 100%, 0 100%)`;
            divider.style.left = `${position}%`;
            handle.style.left = `${position}%`;
            handle.setAttribute("aria-valuenow", String(Math.round(position)));
        };

        const cancelDemo = () => {
            demoCancelled = true;
            window.clearTimeout(demoTimer);
            window.cancelAnimationFrame(demoFrame);
        };

        const easeInOutCubic = (value) => (
            value < 0.5
                ? 4 * value * value * value
                : 1 - Math.pow(-2 * value + 2, 3) / 2
        );

        const playDemo = () => {
            if (demoCancelled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

            const keyframes = [
                { at: 0, value: 64 },
                { at: 0.34, value: 14 },
                { at: 0.72, value: 86 },
                { at: 1, value: 64 }
            ];
            const duration = 2700;
            const startedAt = performance.now();

            const animate = (now) => {
                if (demoCancelled) return;
                const progress = Math.min(1, (now - startedAt) / duration);
                let index = 0;
                while (index < keyframes.length - 2 && progress > keyframes[index + 1].at) index += 1;
                const from = keyframes[index];
                const to = keyframes[index + 1];
                const localProgress = (progress - from.at) / (to.at - from.at);
                const easedProgress = easeInOutCubic(Math.max(0, Math.min(1, localProgress)));
                setPosition(from.value + (to.value - from.value) * easedProgress);

                if (progress < 1) {
                    demoFrame = window.requestAnimationFrame(animate);
                } else {
                    setPosition(Number(sample.dataset.start || 64));
                }
            };

            demoFrame = window.requestAnimationFrame(animate);
        };

        const setFromPointer = (clientX) => {
            const rect = sample.getBoundingClientRect();
            if (rect.width <= 0) return;
            setPosition(((clientX - rect.left) / rect.width) * 100);
        };

        const beginDrag = (event) => {
            event.preventDefault();
            cancelDemo();
            isDragging = true;
            if (sample.setPointerCapture) {
                sample.setPointerCapture(event.pointerId);
            }
            setFromPointer(event.clientX);
        };

        const continueDrag = (event) => {
            if (!isDragging) return;
            event.preventDefault();
            setFromPointer(event.clientX);
        };

        const endDrag = (event) => {
            if (!isDragging) return;
            isDragging = false;
            if (sample.releasePointerCapture && sample.hasPointerCapture?.(event.pointerId)) {
                sample.releasePointerCapture(event.pointerId);
            }
        };

        sample.addEventListener("pointerdown", beginDrag);
        sample.addEventListener("pointermove", continueDrag);
        sample.addEventListener("pointerup", endDrag);
        sample.addEventListener("pointercancel", endDrag);

        handle.addEventListener("keydown", (event) => {
            if (event.key === "ArrowLeft") {
                event.preventDefault();
                cancelDemo();
                setPosition(position - 2);
            } else if (event.key === "ArrowRight") {
                event.preventDefault();
                cancelDemo();
                setPosition(position + 2);
            } else if (event.key === "Home") {
                event.preventDefault();
                cancelDemo();
                setPosition(0);
            } else if (event.key === "End") {
                event.preventDefault();
                cancelDemo();
                setPosition(100);
            }
        });

        setPosition(position);

        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            if ("IntersectionObserver" in window) {
                const observer = new IntersectionObserver((entries) => {
                    if (!entries.some((entry) => entry.isIntersecting)) return;
                    observer.disconnect();
                    demoTimer = window.setTimeout(playDemo, 650);
                }, { threshold: 0.45 });
                observer.observe(sample);
            } else {
                demoTimer = window.setTimeout(playDemo, 900);
            }
        }
    }

    initializeSampleComparison();

    fileInput.addEventListener("change", (event) => {
        const file = event.target.files[0];

        if (file) {
            handleFile(file);
        }
    });

    uploadArea.addEventListener("click", (event) => {
        if (event.target.closest(".select-file")) {
            return;
        }

        fileInput.click();
    });

    uploadArea.setAttribute("tabindex", "0");
    uploadArea.setAttribute("role", "button");

    uploadArea.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fileInput.click();
        }
    });

    // --------------------------------
    // ブラウザ標準のドロップ動作を防止
    // --------------------------------
    ["dragenter", "dragover", "dragleave", "drop"].forEach(
        (eventName) => {
            document.addEventListener(eventName, (event) => {
                event.preventDefault();
                event.stopPropagation();
            });
        }
    );

    // --------------------------------
    // ドラッグ＆ドロップ
    // --------------------------------
    uploadArea.addEventListener("dragenter", () => {
        dragCounter += 1;
        uploadArea.classList.add("dragover");
    });

    uploadArea.addEventListener("dragover", () => {
        uploadArea.classList.add("dragover");
    });

    uploadArea.addEventListener("dragleave", () => {
        dragCounter -= 1;

        if (dragCounter <= 0) {
            dragCounter = 0;
            uploadArea.classList.remove("dragover");
        }
    });

    uploadArea.addEventListener("drop", (event) => {
        dragCounter = 0;
        uploadArea.classList.remove("dragover");

        const file = event.dataTransfer.files[0];

        if (file) {
            handleFile(file);
        }
    });

    // --------------------------------
    // 画像ファイルを読み込む
    // --------------------------------
    function handleFile(file) {
        if (!file || !file.type.startsWith("image/")) {
            statusMessage.textContent =
                "画像ファイルを選択してください。";
            return;
        }

        // メイン写真が変わったら、前の写真用の「あの日の色」は持ち越さない。
        resetReferenceColor();
        statusMessage.textContent = "画像を読み込んでいます…";

        const reader = new FileReader();

        reader.onload = (event) => {
            const imageDataUrl = event.target.result;

            if (typeof imageDataUrl !== "string") {
                clearLoadedImage();
                statusMessage.textContent =
                    "画像データを読み込めませんでした。";
                return;
            }

            const image = new Image();

            image.onload = () => {
                releaseResultObjectUrl();
                lastOutputAb = null;
                lastOutputDims = null;
                currentViewMode = "compare";
                currentComparisonPercent = 50;

                originalImage = imageDataUrl;
                originalImageElement = image;

                showPreview(imageDataUrl, "読み込んだ写真のプレビュー");

                if (uploadPrivacyPromise) uploadPrivacyPromise.hidden = true;
                fileInput.value = "";
                colorizeButton.hidden = false;
                colorizeButton.disabled = false;
                if (previewActions) previewActions.hidden = false;

                statusMessage.textContent =
                    `${image.naturalWidth} × ${image.naturalHeight}px の画像を読み込みました。`;
            };

            image.onerror = () => {
                clearLoadedImage();
                statusMessage.textContent =
                    "画像を読み込めませんでした。";
            };

            image.src = imageDataUrl;
        };

        reader.onerror = () => {
            clearLoadedImage();
            statusMessage.textContent =
                "ファイルの読み込みに失敗しました。";
        };

        reader.readAsDataURL(file);
    }

    // --------------------------------
    // 読み込んだ画像情報を解除
    // --------------------------------
    function clearLoadedImage() {
        releaseResultObjectUrl();
        originalImage = null;
        originalImageElement = null;
        lastOutputAb = null;
        lastOutputDims = null;
        currentViewMode = "compare";
        currentComparisonPercent = 50;
        resetReferenceColor();
        fileInput.value = "";
        preview.innerHTML = "";
        if (uploadPrivacyPromise) uploadPrivacyPromise.hidden = false;
        colorizeButton.hidden = false;
        colorizeButton.disabled = true;
        if (previewActions) previewActions.hidden = true;
    }

    function releaseResultObjectUrl() {
        if (resultObjectUrl) {
            URL.revokeObjectURL(resultObjectUrl);
            resultObjectUrl = null;
        }

        resultBlob = null;
    }

    // --------------------------------
    // プレビュー表示
    // --------------------------------
    function showPreview(imageUrl, altText, options = {}) {
        preview.innerHTML = "";

        if (options.showResultControls && resultObjectUrl) {
            appendComparisonView(options.viewMode || currentViewMode);
            return;
        }

        const previewImage = document.createElement("img");
        previewImage.src = imageUrl;
        previewImage.alt = altText;

        preview.appendChild(previewImage);
    }

    // --------------------------------
    // Before / After 比較表示
    // --------------------------------
    function appendComparisonView(initialViewMode = currentViewMode) {
        currentViewMode = initialViewMode;
        const comparison = document.createElement("div");
        comparison.className = "comparison-view";

        const imageAspect =
            originalImageElement.naturalWidth /
            originalImageElement.naturalHeight;

        const stage = document.createElement("div");
        stage.className = "comparison-stage";
        stage.style.aspectRatio =
            `${originalImageElement.naturalWidth} / ` +
            `${originalImageElement.naturalHeight}`;

        if (imageAspect < 1) {
            stage.classList.add("is-portrait");
            stage.style.width =
                `min(100%, calc(72vh * ${imageAspect}))`;
        }

        const originalPreview = document.createElement("img");
        originalPreview.src = originalImage;
        originalPreview.alt = "元画像";
        originalPreview.className = "comparison-image";
        originalPreview.draggable = false;

        const colorPreview = document.createElement("img");
        colorPreview.src = resultObjectUrl;
        colorPreview.alt = "AIでカラー化した写真";
        colorPreview.className = "comparison-image";
        colorPreview.draggable = false;

        const divider = document.createElement("div");
        divider.className = "comparison-divider";
        divider.setAttribute("aria-hidden", "true");

        const handle = document.createElement("button");
        handle.type = "button";
        handle.className = "comparison-handle";
        handle.setAttribute(
            "aria-label",
            "左右にドラッグして元画像とカラー画像を比較"
        );
        handle.innerHTML = '<span class="comparison-handle-arrows" aria-hidden="true"><i></i><i></i></span>';

        const colorLabel = document.createElement("span");
        colorLabel.className = "comparison-label is-left";
        colorLabel.textContent = "カラー化";

        const originalLabel = document.createElement("span");
        originalLabel.className = "comparison-label is-right";
        originalLabel.textContent = "元画像";

        let comparisonPercent =
            currentViewMode === "original"
                ? 0
                : currentViewMode === "color"
                    ? 100
                    : currentComparisonPercent;
        let isDragging = false;

        const setComparison = (percent) => {
            comparisonPercent = Math.max(
                0,
                Math.min(100, Number(percent))
            );

            colorPreview.style.clipPath =
                `polygon(0 0, ${comparisonPercent}% 0, ` +
                `${comparisonPercent}% 100%, 0 100%)`;
            divider.style.left = `${comparisonPercent}%`;
            handle.style.left = `${comparisonPercent}%`;

            currentComparisonPercent = comparisonPercent;
        };

        const updateViewMode = () => {
            stage.classList.toggle(
                "is-compare",
                currentViewMode === "compare"
            );

            if (currentViewMode === "original") {
                setComparison(0);
            } else if (currentViewMode === "color") {
                setComparison(100);
            } else {
                const position =
                    currentComparisonPercent <= 0 ||
                    currentComparisonPercent >= 100
                        ? 50
                        : currentComparisonPercent;
                setComparison(position);
            }
        };

        const setFromPointer = (clientX) => {
            const rect = stage.getBoundingClientRect();

            if (rect.width <= 0) {
                return;
            }

            const percent =
                ((clientX - rect.left) / rect.width) * 100;

            setComparison(percent);
        };

        const beginDrag = (event) => {
            if (currentViewMode !== "compare") {
                return;
            }

            event.preventDefault();
            isDragging = true;

            if (stage.setPointerCapture) {
                stage.setPointerCapture(event.pointerId);
            }

            setFromPointer(event.clientX);
        };

        const continueDrag = (event) => {
            if (!isDragging) {
                return;
            }

            event.preventDefault();
            setFromPointer(event.clientX);
        };

        const endDrag = (event) => {
            if (!isDragging) {
                return;
            }

            isDragging = false;

            if (
                stage.releasePointerCapture &&
                stage.hasPointerCapture &&
                stage.hasPointerCapture(event.pointerId)
            ) {
                stage.releasePointerCapture(event.pointerId);
            }
        };

        stage.addEventListener("pointerdown", beginDrag);
        stage.addEventListener("pointermove", continueDrag);
        stage.addEventListener("pointerup", endDrag);
        stage.addEventListener("pointercancel", endDrag);

        handle.addEventListener("keydown", (event) => {
            if (event.key === "ArrowLeft") {
                event.preventDefault();
                setComparison(comparisonPercent - 2);
            }

            if (event.key === "ArrowRight") {
                event.preventDefault();
                setComparison(comparisonPercent + 2);
            }

            if (event.key === "Home") {
                event.preventDefault();
                setComparison(0);
            }

            if (event.key === "End") {
                event.preventDefault();
                setComparison(100);
            }
        });

        stage.append(
            originalPreview,
            colorPreview,
            divider,
            handle,
            colorLabel,
            originalLabel
        );

        const resultPanel = document.createElement("div");
        resultPanel.className = "result-panel";

        const colorGroup = createControlGroup("色味");
        const presetButtons = [];
        const presetLocked = Boolean(referenceStats && referenceEnabled);

        Object.entries(COLOR_PRESETS).forEach(([presetId, preset]) => {
            const presetButton = createControlButton(preset.label);
            presetButton.dataset.presetId = presetId;
            presetButton.disabled = presetLocked;

            presetButton.addEventListener("click", async () => {
                if (
                    presetLocked ||
                    isRenderingColor ||
                    !lastOutputAb ||
                    !lastOutputDims ||
                    !originalImageElement
                ) {
                    return;
                }

                const previousMode = currentViewMode;
                const previousPercent = currentComparisonPercent;

                currentColorPreset = presetId;
                isRenderingColor = true;

                try {
                    statusMessage.textContent =
                        `${preset.label}の色味で画像を作り直しています…`;

                    await new Promise((resolve) => {
                        requestAnimationFrame(() => resolve());
                    });

                    await renderColorizedImage(
                        originalImageElement,
                        lastOutputAb,
                        lastOutputDims
                    );

                    currentViewMode = previousMode;
                    currentComparisonPercent = previousPercent;

                    statusMessage.textContent =
                        `${preset.label}の色味へ変更しました。`;
                } catch (error) {
                    console.error("Color preset error:", error);
                    statusMessage.textContent =
                        "色味の変更に失敗しました。";
                } finally {
                    isRenderingColor = false;
                }
            });

            presetButtons.push(presetButton);
            colorGroup.row.appendChild(presetButton);
        });

        setActiveControlButton(
            presetButtons.find(
                (button) =>
                    button.dataset.presetId === currentColorPreset
            ),
            presetButtons
        );

        if (presetLocked) {
            colorGroup.group.classList.add("is-locked");
            const lockedNote = document.createElement("p");
            lockedNote.className = "control-locked-note";
            lockedNote.textContent = "あの日の色を使用中です";
            colorGroup.group.appendChild(lockedNote);
        }

        const referenceGroup = document.createElement("section");
        referenceGroup.className = "control-group reference-group";
        if (referenceStats && referenceEnabled) {
            referenceGroup.classList.add("is-active");
        }

        const referenceHead = document.createElement("div");
        referenceHead.className = "reference-heading";

        const referenceTitle = document.createElement("h2");
        referenceTitle.className = "control-title";
        referenceTitle.textContent = "あの日の色";
        referenceHead.appendChild(referenceTitle);

        if (referenceStats) {
            const toggleLabel = document.createElement("label");
            toggleLabel.className = "reference-toggle";
            const toggleInput = document.createElement("input");
            toggleInput.type = "checkbox";
            toggleInput.checked = referenceEnabled;
            const toggleTrack = document.createElement("span");
            toggleTrack.className = "reference-toggle-track";
            const toggleText = document.createElement("span");
            toggleText.className = "reference-toggle-text";
            toggleText.textContent = referenceEnabled ? "使用中" : "使用しない";
            toggleInput.addEventListener("change", async () => {
                referenceEnabled = toggleInput.checked;
                statusMessage.textContent = referenceEnabled
                    ? "あの日の色を使用しています。"
                    : "あの日の色を外しました。";
                await rerenderCurrentColor();
            });
            toggleLabel.append(toggleInput, toggleTrack, toggleText);
            referenceHead.appendChild(toggleLabel);
        }

        const referenceCopy = document.createElement("p");
        referenceCopy.className = "reference-copy";
        referenceCopy.textContent =
            "同じ日に撮影したカラー写真を追加すると、その日の色味や空気感をより自然に反映できます。";

        const referencePicker = document.createElement("div");
        referencePicker.className = "reference-picker";

        const referenceInput = document.createElement("input");
        referenceInput.type = "file";
        referenceInput.accept = "image/*";
        referenceInput.hidden = true;

        const referenceButton = createControlButton(
            referenceStats ? "写真を変更" : "写真を追加",
            "is-secondary"
        );
        if (!referenceStats) {
            addLeadingPlusIcon(referenceButton);
        }
        const referenceFileLabel = document.createElement("span");
        referenceFileLabel.className = "reference-file-name";
        referenceFileLabel.textContent = referenceStats
            ? referenceFileName || "カラー写真を追加済み"
            : "まだ追加されていません";

        const referenceLoading = document.createElement("span");
        referenceLoading.className = "reference-loading";
        referenceLoading.hidden = true;
        referenceLoading.innerHTML = '<i aria-hidden="true"></i><span>色味を読み取っています…</span>';

        referenceButton.addEventListener("click", () => referenceInput.click());
        referenceInput.addEventListener("change", async () => {
            const file = referenceInput.files[0];
            if (!file) return;
            try {
                referenceButton.disabled = true;
                referenceButton.classList.add("is-loading");
                referenceLoading.hidden = false;
                referenceFileLabel.hidden = true;
                statusMessage.textContent = "カラー写真の色味を読み取っています…";
                referenceStats = await analyzeReferenceImage(file);
                referenceFileName = file.name;
                referenceEnabled = true;
                statusMessage.textContent = "カラー写真の色味を読み取りました。";
                await rerenderCurrentColor("color");
            } catch (error) {
                console.error("Reference image error:", error);
                statusMessage.textContent = "カラー写真を読み取れませんでした。";
            } finally {
                referenceInput.value = "";
                referenceButton.disabled = false;
                referenceButton.classList.remove("is-loading");
                referenceLoading.hidden = true;
                referenceFileLabel.hidden = false;
            }
        });

        referencePicker.append(referenceInput, referenceButton, referenceFileLabel, referenceLoading);

        if (referenceStats) {
            const removeButton = createControlButton("削除", "is-quiet-danger");
            removeButton.addEventListener("click", async () => {
                resetReferenceColor();
                statusMessage.textContent = "あの日の色を削除しました。";
                await rerenderCurrentColor();
            });
            referencePicker.appendChild(removeButton);
        }

        referenceGroup.append(referenceHead, referenceCopy);

        if (referenceStats) {
            const strengthWrap = document.createElement("div");
            strengthWrap.className = "reference-strength is-near-picker";
            const strengthHead = document.createElement("div");
            strengthHead.className = "reference-strength-head";
            const strengthLabel = document.createElement("span");
            strengthLabel.textContent = "反映度";
            const strengthValue = document.createElement("span");
            strengthValue.textContent = `${referenceStrength}%`;
            const strengthInput = document.createElement("input");
            strengthInput.type = "range";
            strengthInput.min = "0";
            strengthInput.max = "100";
            strengthInput.step = "5";
            strengthInput.value = String(referenceStrength);
            strengthInput.setAttribute("aria-label", "あの日の色の反映度");
            strengthInput.disabled = !referenceEnabled;
            let strengthRenderTimer = null;
            strengthInput.addEventListener("input", () => {
                referenceStrength = Number(strengthInput.value);
                strengthValue.textContent = `${referenceStrength}%`;
                window.clearTimeout(strengthRenderTimer);
                strengthRenderTimer = window.setTimeout(rerenderCurrentColor, 180);
            });
            strengthInput.addEventListener("change", rerenderCurrentColor);
            strengthHead.append(strengthLabel, strengthValue);
            strengthWrap.append(strengthHead, strengthInput);
            referenceGroup.appendChild(strengthWrap);
        }

        referenceGroup.appendChild(referencePicker);

        if (referenceStats) {
            const atmosphere = createAtmosphereSummary(referenceStats);
            referenceGroup.appendChild(atmosphere);
        }

        const viewGroup = createControlGroup("表示");
        const originalButton = createControlButton("元画像");
        const compareButton = createControlButton("比較");
        const resultButton = createControlButton("カラー写真");
        const viewButtons = [
            originalButton,
            compareButton,
            resultButton
        ];

        originalButton.addEventListener("click", () => {
            currentViewMode = "original";
            updateViewMode();
            setActiveControlButton(originalButton, viewButtons);
        });

        compareButton.addEventListener("click", () => {
            currentViewMode = "compare";
            updateViewMode();
            setActiveControlButton(compareButton, viewButtons);
        });

        resultButton.addEventListener("click", () => {
            currentViewMode = "color";
            updateViewMode();
            setActiveControlButton(resultButton, viewButtons);
        });

        viewGroup.row.append(
            originalButton,
            compareButton,
            resultButton
        );

        const activeViewButton =
            currentViewMode === "original"
                ? originalButton
                : currentViewMode === "color"
                    ? resultButton
                    : compareButton;

        setActiveControlButton(activeViewButton, viewButtons);

        const saveGroup = createControlGroup("保存", "save-row");
        const pngButton = createControlButton(
            "PNGで保存",
            "is-save"
        );
        const jpegButton = createControlButton(
            "JPEGで保存",
            "is-save"
        );

        pngButton.addEventListener("click", () => {
            downloadColorizedImage("png");
        });

        jpegButton.addEventListener("click", () => {
            downloadColorizedImage("jpeg");
        });

        saveGroup.row.append(pngButton, jpegButton);

        if (isAppleMobile) {
            const saveGuide = document.createElement("p");
            saveGuide.className = "save-location-guide";
            saveGuide.textContent = "通常の保存先は「ファイル」アプリ内のダウンロードです。写真アプリへ保存する場合は、下のボタンから共有メニューを開き「画像を保存」を選んでください。";
            saveGroup.group.appendChild(saveGuide);

            if (navigator.share && typeof File === "function") {
                const photoSaveButton = createControlButton(
                    "iPhoneで写真に保存",
                    "is-photo-save"
                );
                photoSaveButton.addEventListener("click", shareColorizedImage);
                saveGroup.group.appendChild(photoSaveButton);
            }
        }

        const anotherGroup = document.createElement("div");
        anotherGroup.className = "control-group";

        const anotherButton = createControlButton(
            "別の写真を選ぶ",
            "is-secondary"
        );

        anotherButton.addEventListener("click", () => {
            fileInput.click();
        });

        anotherGroup.appendChild(anotherButton);

        resultPanel.append(
            colorGroup.group,
            viewGroup.group,
            saveGroup.group,
            referenceGroup,
            anotherGroup
        );

        comparison.append(stage, resultPanel);
        preview.appendChild(comparison);

        updateViewMode();
        colorizeButton.hidden = true;
    }

    function createControlGroup(title, rowClass = "") {
        const group = document.createElement("section");
        group.className = "control-group";

        const heading = document.createElement("h2");
        heading.className = "control-title";
        heading.textContent = title;

        const row = document.createElement("div");
        row.className = "control-row";

        if (rowClass) {
            row.classList.add(rowClass);
        }

        group.append(heading, row);

        return {
            group,
            row
        };
    }

    function createControlButton(label, extraClass = "") {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "control-button";
        button.textContent = label;

        if (extraClass) {
            button.classList.add(extraClass);
        }

        return button;
    }

    function addLeadingPlusIcon(button) {
        const label = button.textContent;
        button.textContent = "";
        const icon = document.createElement("span");
        icon.className = "control-button-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = "+";
        const text = document.createElement("span");
        text.textContent = label;
        button.append(icon, text);
    }

    function setActiveControlButton(activeButton, buttons) {
        buttons.forEach((button) => {
            button.classList.toggle(
                "is-active",
                button === activeButton
            );
        });
    }

    function resetReferenceColor() {
        referenceStats = null;
        referenceStrength = 50;
        referenceEnabled = false;
        referenceFileName = "";
    }

    function formatSignedPercent(value) {
        const rounded = Math.round(value);
        return `${rounded > 0 ? "+" : ""}${rounded}%`;
    }

    function createAtmosphereSummary(stats) {
        const section = document.createElement("div");
        section.className = "atmosphere-summary";

        const heading = document.createElement("p");
        heading.className = "atmosphere-title";
        heading.textContent = "あの日の空気感";

        const metrics = document.createElement("div");
        metrics.className = "atmosphere-metrics";

        const warmth = Math.max(-30, Math.min(30, stats.b * 1.15));
        const colorfulness = Math.max(-30, Math.min(30, (stats.chroma - 22) * 1.3));
        const brightness = Math.max(-30, Math.min(30, (stats.lightness - 52) * 0.85));

        [
            ["暖かさ", warmth],
            ["彩り", colorfulness],
            ["明るさ", brightness]
        ].forEach(([label, value]) => {
            const item = document.createElement("div");
            item.className = "atmosphere-metric";
            const name = document.createElement("span");
            name.textContent = label;
            const amount = document.createElement("strong");
            amount.textContent = formatSignedPercent(value);
            item.append(name, amount);
            metrics.appendChild(item);
        });

        const note = document.createElement("p");
        note.className = "atmosphere-note";
        note.textContent = describeAtmosphere(warmth, colorfulness, brightness);

        section.append(heading, metrics, note);
        return section;
    }

    function describeAtmosphere(warmth, colorfulness, brightness) {
        const words = [];
        if (warmth >= 8) words.push("あたたかな色合い");
        else if (warmth <= -8) words.push("涼やかな色合い");
        else words.push("穏やかな色合い");

        if (colorfulness >= 8) words.push("豊かな彩り");
        else if (colorfulness <= -8) words.push("落ち着いた彩り");
        else words.push("自然な彩り");

        if (brightness >= 8) words.push("やわらかな光");
        else if (brightness <= -8) words.push("深みのある光");
        else words.push("自然な明るさ");

        return words.join(" ・ ");
    }

    async function rerenderCurrentColor(forcedViewMode = null) {
        if (isRenderingColor || !lastOutputAb || !lastOutputDims || !originalImageElement) return;
        const previousMode = currentViewMode;
        const previousPercent = currentComparisonPercent;
        const targetViewMode = forcedViewMode || previousMode;
        isRenderingColor = true;
        try {
            currentViewMode = targetViewMode;
            currentComparisonPercent = previousPercent;
            await new Promise((resolve) => requestAnimationFrame(resolve));
            await renderColorizedImage(
                originalImageElement,
                lastOutputAb,
                lastOutputDims,
                targetViewMode
            );
            currentViewMode = targetViewMode;
        } finally {
            isRenderingColor = false;
        }
    }

    function analyzeReferenceImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = () => {
                const image = new Image();
                image.onerror = reject;
                image.onload = () => {
                    const canvas = document.createElement("canvas");
                    const size = 96;
                    const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight, 1);
                    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
                    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
                    const context = canvas.getContext("2d", { willReadFrequently: true });
                    context.drawImage(image, 0, 0, canvas.width, canvas.height);
                    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
                    let sumL = 0, sumA = 0, sumB = 0, sumChroma = 0, count = 0;
                    for (let i = 0; i < data.length; i += 16) {
                        if (data[i + 3] < 16) continue;
                        const lab = rgbToLab(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
                        sumL += lab.l;
                        sumA += lab.a;
                        sumB += lab.b;
                        sumChroma += Math.hypot(lab.a, lab.b);
                        count += 1;
                    }
                    if (!count) return reject(new Error("No pixels"));
                    resolve({
                        lightness: sumL / count,
                        a: sumA / count,
                        b: sumB / count,
                        chroma: sumChroma / count
                    });
                };
                image.src = String(reader.result);
            };
            reader.readAsDataURL(file);
        });
    }

    async function shareColorizedImage() {
        if (!resultBlob) {
            statusMessage.textContent = "保存できるカラー写真がありません。";
            return;
        }

        try {
            const file = new File(
                [resultBlob],
                createDownloadFileName("png"),
                { type: resultBlob.type || "image/png" }
            );

            if (navigator.canShare && !navigator.canShare({ files: [file] })) {
                throw new Error("このブラウザでは画像共有を利用できません。");
            }

            statusMessage.textContent =
                "共有メニューで「画像を保存」を選ぶと、写真アプリに保存できます。";
            await navigator.share({
                files: [file],
                title: "COLOR RE:FINE",
                text: "カラー化した写真"
            });
        } catch (error) {
            if (error && error.name === "AbortError") {
                statusMessage.textContent = "写真への保存をキャンセルしました。";
                return;
            }
            console.error("Share error:", error);
            statusMessage.textContent =
                "共有メニューを開けませんでした。PNGまたはJPEGで保存してください。";
        }
    }

    async function downloadColorizedImage(format) {
        if (!resultObjectUrl || !resultBlob) {
            statusMessage.textContent =
                "保存できるカラー画像がありません。";
            return;
        }

        try {
            let blob = resultBlob;
            let extension = "png";
            let formatLabel = "PNG";

            if (format === "jpeg") {
                blob = await canvasToBlob(
                    outputCanvas,
                    "image/jpeg",
                    0.92
                );
                extension = "jpg";
                formatLabel = "JPEG";
            }

            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = downloadUrl;
            link.download = createDownloadFileName(extension);
            document.body.appendChild(link);
            link.click();
            link.remove();

            window.setTimeout(() => {
                URL.revokeObjectURL(downloadUrl);
            }, 1000);

            statusMessage.textContent = isAppleMobile
                ? `カラー写真を${formatLabel}形式で「ファイル」アプリのダウンロードに保存しました。`
                : `カラー写真を${formatLabel}形式で保存しました。`;
        } catch (error) {
            console.error("Download error:", error);
            statusMessage.textContent =
                "カラー画像の保存に失敗しました。";
        }
    }

    function createDownloadFileName(extension) {
        const now = new Date();
        const stamp = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, "0"),
            String(now.getDate()).padStart(2, "0"),
            "-",
            String(now.getHours()).padStart(2, "0"),
            String(now.getMinutes()).padStart(2, "0"),
            String(now.getSeconds()).padStart(2, "0")
        ].join("");

        return `color-refine-${stamp}.${extension}`;
    }

    function showLoading(title, detail, percent = null) {
        if (!loadingOverlay) return;
        loadingOverlay.hidden = false;
        loadingTitle.textContent = title;
        loadingDetail.textContent = detail || "";
        if (percent === null) {
            loadingProgress.classList.add("is-indeterminate");
            loadingPercent.textContent = "処理中";
        } else {
            loadingProgress.classList.remove("is-indeterminate");
            const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
            loadingProgressBar.style.width = `${safePercent}%`;
            loadingPercent.textContent = `${safePercent}%`;
        }
    }

    function hideLoading() {
        if (!loadingOverlay) return;
        loadingOverlay.hidden = true;
        loadingProgress.classList.remove("is-indeterminate");
        loadingProgressBar.style.width = "0%";
    }

    function waitForNextPaint() {
        return new Promise((resolve) => {
            requestAnimationFrame(() => {
                requestAnimationFrame(resolve);
            });
        });
    }

    async function openModelCache() {
        if (!("caches" in window)) return null;
        try {
            return await caches.open(MODEL_CACHE_NAME);
        } catch (error) {
            console.warn("AIモデル用キャッシュを開けませんでした。", error);
            return null;
        }
    }

    async function fetchModelResponse(url) {
        const cache = await openModelCache();
        if (cache) {
            const cached = await cache.match(url);
            if (cached) return { response: cached, fromCache: true };
        }

        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`モデルデータを取得できませんでした（${response.status}）。`);
        }

        if (cache) {
            cache.put(url, response.clone()).catch((error) => {
                console.warn("AIモデルをブラウザへ保存できませんでした。", error);
            });
        }
        return { response, fromCache: false };
    }

    async function fetchBinaryWithProgress(url, onProgress) {
        const { response, fromCache } = await fetchModelResponse(url);
        const total = Number(response.headers.get("content-length")) || 0;

        if (fromCache || !response.body || !response.body.getReader) {
            const buffer = await response.arrayBuffer();
            if (typeof onProgress === "function") onProgress(100);
            return new Uint8Array(buffer);
        }

        const reader = response.body.getReader();
        const chunks = [];
        let loaded = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.byteLength;
            if (total && typeof onProgress === "function") {
                onProgress((loaded / total) * 100);
            }
        }

        const bytes = new Uint8Array(loaded);
        let offset = 0;
        chunks.forEach((chunk) => {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
        });
        if (typeof onProgress === "function") onProgress(100);
        return bytes;
    }

    async function deleteStoredModel() {
        const confirmed = window.confirm(
            "ブラウザ内に保存したAIモデルを削除します。次回のカラー化では約215MBを再ダウンロードします。よろしいですか？"
        );
        if (!confirmed) return;

        deleteModelCacheButton.disabled = true;
        try {
            if (session && typeof session.release === "function") {
                await session.release();
            }
            session = null;
            const deleted = "caches" in window
                ? await caches.delete(MODEL_CACHE_NAME)
                : false;
            statusMessage.textContent = deleted
                ? "保存したAIモデルを削除しました。次回はWi-Fi環境でのダウンロードをおすすめします。"
                : "このブラウザには、COLOR RE:FINEが削除できるAIモデルは保存されていません。";
        } catch (error) {
            console.error("Model cache delete error:", error);
            statusMessage.textContent = "AIモデルを削除できませんでした。ブラウザのサイトデータ設定をご確認ください。";
        } finally {
            deleteModelCacheButton.disabled = false;
        }
    }

    async function fetchExternalModelData() {
        const { response } = await fetchModelResponse("models/ddcolor.data.manifest.json");
        const manifest = await response.json();
        const totalSize = Number(manifest.totalSize);
        const parts = Array.isArray(manifest.parts) ? manifest.parts : [];
        if (!totalSize || !parts.length) {
            throw new Error("モデル構成ファイルが正しくありません。");
        }

        const combined = new Uint8Array(totalSize);
        let completedBytes = 0;
        for (const part of parts) {
            const partSize = Number(part.size) || 0;
            const bytes = await fetchBinaryWithProgress(
                `models/${part.file}`,
                (partPercent) => {
                    const loadedInPart = partSize * (partPercent / 100);
                    const totalPercent = ((completedBytes + loadedInPart) / totalSize) * 100;
                    showLoading(
                        "思い出を彩る準備をしています…",
                        `初回のみ、約215MBのAIモデルを読み込みます。Wi-Fi推奨（${parts.indexOf(part) + 1}/${parts.length}）。`,
                        totalPercent
                    );
                }
            );
            if (partSize && bytes.byteLength !== partSize) {
                throw new Error(`モデル分割ファイル「${part.file}」のサイズが正しくありません。`);
            }
            combined.set(bytes, completedBytes);
            completedBytes += bytes.byteLength;
        }
        if (completedBytes !== totalSize) {
            throw new Error("AIモデルの合計サイズが正しくありません。");
        }
        return combined;
    }

    // --------------------------------
    // カラー化ボタン
    // --------------------------------
    colorizeButton.addEventListener("click", async () => {
        if (!originalImage || !originalImageElement) {
            statusMessage.textContent =
                "先に画像を選択してください。";
            return;
        }

        colorizeButton.disabled = true;
        const slowProcessingTimer = window.setTimeout(() => {
            statusMessage.textContent =
                "処理に時間がかかっています。長時間変化がない場合は、ほかのアプリやタブを閉じて端末を再起動してからお試しください。";
            showLoading(
                "処理を続けています…",
                "メモリが不足すると反応が止まる場合があります。ほかのアプリやタブを閉じると改善することがあります。",
                null
            );
        }, 35000);

        try {
            if (session) {
                showLoading(
                    "思い出を丁寧に彩っています…",
                    "写真の明るさを読み取っています。",
                    null
                );
            } else {
                showLoading(
                    "写真を彩る準備をしています",
                    "初回のみ約215MBをダウンロードします。Wi-Fi環境でのご利用をおすすめします。",
                    0
                );
            }
            await waitForNextPaint();
            await inferImage();
        } catch (error) {
            console.error("COLOR RE:FINE error:", error);

            const detail =
                error instanceof Error ? error.message : String(error);
            const normalizedDetail = detail.toLowerCase();
            const looksLikeMemoryError =
                error instanceof RangeError ||
                /memory|out of memory|allocation|array buffer/.test(normalizedDetail);

            statusMessage.textContent = looksLikeMemoryError
                ? "端末のメモリが不足した可能性があります。ほかのアプリやタブを閉じ、端末を再起動してからもう一度お試しください。"
                : `AI処理中にエラーが発生しました。${detail ? ` ${detail}` : ""}`;
        } finally {
            window.clearTimeout(slowProcessingTimer);
            hideLoading();
            colorizeButton.disabled = false;
        }
    });

    // --------------------------------
    // DDColor推論
    // --------------------------------
    async function inferImage() {
        const activeSession = await loadModel();
        const startedAt = performance.now();

        statusMessage.textContent =
            "AI処理用の画像を準備しています…";
        showLoading("思い出を丁寧に彩っています…", "写真の明るさを読み取っています。", null);
        await waitForNextPaint();

        // 公式DDColorの前処理と同じ考え方で、
        // 画像をLabへ変換してLだけ残し、無彩色RGBへ戻して入力する。
        const tensorData = prepareInferenceTensor(
            originalImageElement,
            MODEL_WIDTH,
            MODEL_HEIGHT
        );

        const inputName = activeSession.inputNames[0];
        const outputName = activeSession.outputNames[0];
        const inputTensor = new window.ort.Tensor(
            "float32",
            tensorData,
            [1, 3, MODEL_HEIGHT, MODEL_WIDTH]
        );

        statusMessage.textContent =
            "AIが写真をカラー化しています…";
        showLoading("思い出を丁寧に彩っています…", "色を探しています。もうすぐ完成です。", null);

        const feeds = {
            [inputName]: inputTensor
        };

        const results = await activeSession.run(feeds);
        const outputTensor = results[outputName];

        if (!outputTensor) {
            throw new Error(
                `モデル出力「${outputName}」を取得できませんでした。`
            );
        }

        validateOutputTensor(outputTensor);

        statusMessage.textContent =
            "AIの色情報を元の解像度へ合成しています…";
        showLoading("最後の仕上げをしています…", "元の写真へ、見つけた色を丁寧に重ねています。", null);

        lastOutputAb = new Float32Array(outputTensor.data);
        lastOutputDims = Array.from(outputTensor.dims || []);

        await renderColorizedImage(
            originalImageElement,
            lastOutputAb,
            lastOutputDims
        );

        const elapsedSeconds =
            ((performance.now() - startedAt) / 1000).toFixed(1);

        const completedPreset =
            COLOR_PRESETS[currentColorPreset] ||
            COLOR_PRESETS.natural;

        statusMessage.textContent =
            `${completedPreset.label}の色味でカラー化が完了しました（${originalImageElement.naturalWidth} × ${originalImageElement.naturalHeight}px・${elapsedSeconds}秒）。`;
    }

    // --------------------------------
    // DDColorモデルを読み込む
    // --------------------------------
    async function loadModel() {
        if (session) {
            return session;
        }

        if (!window.ort) {
            throw new Error(
                "AI実行機能を読み込めませんでした。通信状態を確認して再読み込みしてください。"
            );
        }

        statusMessage.textContent =
            "思い出を彩る準備をしています。初回のみ少し時間がかかります…";
        showLoading("思い出を彩る準備をしています…", "初回のみ約215MBをダウンロードします。Wi-Fi環境でのご利用をおすすめします。", 0);

        session = await createModelSessionWithRecovery();

        console.log("DDColorモデルを読み込みました。");
        console.log("入力名:", session.inputNames);
        console.log("出力名:", session.outputNames);

        return session;
    }


    async function createModelSessionWithRecovery() {
        let firstError = null;

        for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
                const modelBytes = await fetchBinaryWithProgress("models/ddcolor.onnx");
                const externalDataBytes = await fetchExternalModelData();

                if (modelBytes.byteLength < 100000) {
                    throw new Error("AIモデル本体のサイズが正しくありません。");
                }

                showLoading(
                    "もうすぐ準備が整います…",
                    "読み込んだAIモデルをブラウザ内で展開しています。",
                    null
                );

                return await window.ort.InferenceSession.create(modelBytes, {
                    executionProviders: ["wasm"],
                    externalData: [
                        {
                            path: "ddcolor.data",
                            data: externalDataBytes
                        }
                    ]
                });
            } catch (error) {
                if (attempt === 0 && "caches" in window) {
                    firstError = error;
                    console.warn(
                        "AIモデルのキャッシュ不整合を検出したため、削除して再取得します。",
                        error
                    );
                    await caches.delete(MODEL_CACHE_NAME);
                    showLoading(
                        "AIモデルを再確認しています…",
                        "保存データの不整合を修復するため、モデルを再ダウンロードしています。",
                        0
                    );
                    continue;
                }

                const detail = error instanceof Error ? error.message : String(error);
                const firstDetail = firstError instanceof Error ? firstError.message : "";
                throw new Error(
                    `AIモデルを読み込めませんでした。${detail || firstDetail || "ブラウザを再読み込みしてください。"}`
                );
            }
        }

        throw new Error("AIモデルを読み込めませんでした。");
    }

    // --------------------------------
    // 公式DDColor相当の入力Tensorを作成
    // --------------------------------
    function prepareInferenceTensor(image, targetWidth, targetHeight) {
        aiCanvas.width = targetWidth;
        aiCanvas.height = targetHeight;

        aiContext.clearRect(0, 0, targetWidth, targetHeight);
        aiContext.drawImage(image, 0, 0, targetWidth, targetHeight);

        const imageData = aiContext.getImageData(
            0,
            0,
            targetWidth,
            targetHeight
        );

        const rgba = imageData.data;
        const pixelCount = targetWidth * targetHeight;
        const tensor = new Float32Array(pixelCount * 3);

        const redOffset = 0;
        const greenOffset = pixelCount;
        const blueOffset = pixelCount * 2;

        for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
            const rgbaIndex = pixelIndex * 4;
            const red = rgba[rgbaIndex] / 255;
            const green = rgba[rgbaIndex + 1] / 255;
            const blue = rgba[rgbaIndex + 2] / 255;

            const lab = rgbToLab(red, green, blue);
            const grayRgb = labToRgb(lab.l, 0, 0);

            tensor[redOffset + pixelIndex] = grayRgb.r;
            tensor[greenOffset + pixelIndex] = grayRgb.g;
            tensor[blueOffset + pixelIndex] = grayRgb.b;
        }

        return tensor;
    }

    // --------------------------------
    // 出力Tensorを確認
    // --------------------------------
    function validateOutputTensor(outputTensor) {
        const dims = Array.from(outputTensor.dims || []);
        const expectedLength = MODEL_WIDTH * MODEL_HEIGHT * 2;

        if (outputTensor.type !== "float32") {
            throw new Error(
                `予期しない出力型です: ${outputTensor.type}`
            );
        }

        if (outputTensor.data.length !== expectedLength) {
            throw new Error(
                `予期しない出力サイズです: [${dims.join(", ")}]`
            );
        }
    }

    // --------------------------------
    // 推論結果のabを元解像度のLへ合成
    // --------------------------------
    async function renderColorizedImage(
        image,
        outputAb,
        outputDims,
        viewMode = currentViewMode
    ) {
        const width = image.naturalWidth;
        const height = image.naturalHeight;

        sourceCanvas.width = width;
        sourceCanvas.height = height;
        sourceContext.clearRect(0, 0, width, height);
        sourceContext.drawImage(image, 0, 0, width, height);

        const sourceImageData = sourceContext.getImageData(
            0,
            0,
            width,
            height
        );
        const sourceRgba = sourceImageData.data;

        outputCanvas.width = width;
        outputCanvas.height = height;

        const resultImageData = outputContext.createImageData(width, height);
        const resultRgba = resultImageData.data;

        const modelHeight = Number(outputDims[2]) || MODEL_HEIGHT;
        const modelWidth = Number(outputDims[3]) || MODEL_WIDTH;
        const channelSize = modelWidth * modelHeight;

        for (let y = 0; y < height; y += 1) {
            const modelY = mapCoordinate(y, height, modelHeight);
            const y0 = Math.floor(modelY);
            const y1 = Math.min(y0 + 1, modelHeight - 1);
            const yWeight = modelY - y0;

            for (let x = 0; x < width; x += 1) {
                const pixelIndex = y * width + x;
                const rgbaIndex = pixelIndex * 4;

                const red = sourceRgba[rgbaIndex] / 255;
                const green = sourceRgba[rgbaIndex + 1] / 255;
                const blue = sourceRgba[rgbaIndex + 2] / 255;
                const originalLab = rgbToLab(red, green, blue);

                const modelX = mapCoordinate(x, width, modelWidth);
                const x0 = Math.floor(modelX);
                const x1 = Math.min(x0 + 1, modelWidth - 1);
                const xWeight = modelX - x0;

                const a = bilinearSample(
                    outputAb,
                    0,
                    channelSize,
                    modelWidth,
                    x0,
                    x1,
                    y0,
                    y1,
                    xWeight,
                    yWeight
                );

                const b = bilinearSample(
                    outputAb,
                    1,
                    channelSize,
                    modelWidth,
                    x0,
                    x1,
                    y0,
                    y1,
                    xWeight,
                    yWeight
                );

                const adjustedColor = adjustPredictedColor(a, b);
                const colorRgb = labToRgb(
                    originalLab.l,
                    adjustedColor.a,
                    adjustedColor.b
                );

                resultRgba[rgbaIndex] = Math.round(colorRgb.r * 255);
                resultRgba[rgbaIndex + 1] = Math.round(colorRgb.g * 255);
                resultRgba[rgbaIndex + 2] = Math.round(colorRgb.b * 255);
                resultRgba[rgbaIndex + 3] = sourceRgba[rgbaIndex + 3];
            }
        }

        outputContext.putImageData(resultImageData, 0, 0);

        const blob = await canvasToBlob(outputCanvas, "image/png");

        releaseResultObjectUrl();
        resultBlob = blob;
        resultObjectUrl = URL.createObjectURL(blob);

        showPreview(
            resultObjectUrl,
            "AIでカラー化した写真",
            { showResultControls: true, viewMode }
        );
    }

    // --------------------------------
    // DDColor出力の自然色補正
    // --------------------------------
    function adjustPredictedColor(a, b) {
        const preset =
            COLOR_PRESETS[currentColorPreset] ||
            COLOR_PRESETS.natural;

        let adjustedA = a * preset.aStrength;
        let adjustedB = b * preset.bStrength;

        const chroma = Math.hypot(adjustedA, adjustedB);

        if (chroma > preset.softLimit) {
            const excess = chroma - preset.softLimit;
            const compressedChroma =
                preset.softLimit +
                excess * preset.compression;
            const scale = compressedChroma / chroma;

            adjustedA *= scale;
            adjustedB *= scale;
        }

        if (referenceStats && referenceEnabled && referenceStrength > 0) {
            const mix = (referenceStrength / 100) * 0.28;
            const targetChroma = Math.max(8, Math.min(50, referenceStats.chroma));
            const targetLength = Math.hypot(referenceStats.a, referenceStats.b) || 1;
            const targetA = (referenceStats.a / targetLength) * targetChroma;
            const targetB = (referenceStats.b / targetLength) * targetChroma;
            adjustedA = adjustedA * (1 - mix) + targetA * mix;
            adjustedB = adjustedB * (1 - mix) + targetB * mix;
        }

        return {
            a: adjustedA,
            b: adjustedB
        };
    }

    function canvasToBlob(canvas, mimeType, quality) {
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                    return;
                }

                reject(
                    new Error("カラー画像の生成に失敗しました。")
                );
            }, mimeType, quality);
        });
    }

    function mapCoordinate(position, sourceSize, targetSize) {
        if (sourceSize <= 1 || targetSize <= 1) {
            return 0;
        }

        // PyTorch interpolateの一般的なalign_corners=falseに近い座標対応。
        const mapped = ((position + 0.5) * targetSize) / sourceSize - 0.5;
        return clamp(mapped, 0, targetSize - 1);
    }

    function bilinearSample(
        data,
        channel,
        channelSize,
        rowWidth,
        x0,
        x1,
        y0,
        y1,
        xWeight,
        yWeight
    ) {
        const channelOffset = channel * channelSize;
        const topLeft = data[channelOffset + y0 * rowWidth + x0];
        const topRight = data[channelOffset + y0 * rowWidth + x1];
        const bottomLeft = data[channelOffset + y1 * rowWidth + x0];
        const bottomRight = data[channelOffset + y1 * rowWidth + x1];

        const top = topLeft + (topRight - topLeft) * xWeight;
        const bottom = bottomLeft + (bottomRight - bottomLeft) * xWeight;

        return top + (bottom - top) * yWeight;
    }

    // --------------------------------
    // sRGB（0〜1）→ CIE Lab
    // OpenCVのfloat画像と同じ標準的なD65 Lab範囲を使用。
    // L: 0〜100 / a,b: おおむね-128〜127
    // --------------------------------
    function rgbToLab(red, green, blue) {
        const linearRed = srgbToLinear(red);
        const linearGreen = srgbToLinear(green);
        const linearBlue = srgbToLinear(blue);

        const x =
            linearRed * 0.4124564 +
            linearGreen * 0.3575761 +
            linearBlue * 0.1804375;
        const y =
            linearRed * 0.2126729 +
            linearGreen * 0.7151522 +
            linearBlue * 0.072175;
        const z =
            linearRed * 0.0193339 +
            linearGreen * 0.119192 +
            linearBlue * 0.9503041;

        const fx = labForward(x / 0.95047);
        const fy = labForward(y);
        const fz = labForward(z / 1.08883);

        return {
            l: 116 * fy - 16,
            a: 500 * (fx - fy),
            b: 200 * (fy - fz)
        };
    }

    // --------------------------------
    // CIE Lab → sRGB（0〜1）
    // --------------------------------
    function labToRgb(l, a, b) {
        const fy = (l + 16) / 116;
        const fx = fy + a / 500;
        const fz = fy - b / 200;

        const x = 0.95047 * labInverse(fx);
        const y = labInverse(fy);
        const z = 1.08883 * labInverse(fz);

        const linearRed =
            x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
        const linearGreen =
            x * -0.969266 + y * 1.8760108 + z * 0.041556;
        const linearBlue =
            x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

        return {
            r: clamp(linearToSrgb(linearRed), 0, 1),
            g: clamp(linearToSrgb(linearGreen), 0, 1),
            b: clamp(linearToSrgb(linearBlue), 0, 1)
        };
    }

    function srgbToLinear(value) {
        const clamped = clamp(value, 0, 1);

        return clamped <= 0.04045
            ? clamped / 12.92
            : Math.pow((clamped + 0.055) / 1.055, 2.4);
    }

    function linearToSrgb(value) {
        return value <= 0.0031308
            ? 12.92 * value
            : 1.055 * Math.pow(Math.max(value, 0), 1 / 2.4) - 0.055;
    }

    function labForward(value) {
        const epsilon = 216 / 24389;
        const kappa = 24389 / 27;

        return value > epsilon
            ? Math.cbrt(value)
            : (kappa * value + 16) / 116;
    }

    function labInverse(value) {
        const epsilon = 216 / 24389;
        const kappa = 24389 / 27;
        const cubed = value * value * value;

        return cubed > epsilon
            ? cubed
            : (116 * value - 16) / kappa;
    }

    function clamp(value, minimum, maximum) {
        return Math.min(Math.max(value, minimum), maximum);
    }
});
