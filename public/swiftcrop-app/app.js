(() => {
  'use strict';

  const STORAGE_KEY = 'swiftcrop.settings.v2';
  const RECENT_KEY = 'swiftcrop.recentSizes.v2';
  const FORMAT_KEY = 'swiftcrop.outputFormat.v2.3';
  const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const MAX_DIMENSION = 12000;
  const MAX_RECENT = 6;
  const RATIO_SIZE_OPTIONS = {
    '1:1': [
      { width: 540, height: 540 },
      { width: 1024, height: 1024, default: true },
      { width: 1080, height: 1080 },
      { width: 2160, height: 2160 },
      { width: 4320, height: 4320 }
    ],
    '16:9': [
      { width: 1280, height: 720 },
      { width: 1920, height: 1080, default: true },
      { width: 3840, height: 2160 },
      { width: 7680, height: 4320 }
    ],
    '9:16': [
      { width: 720, height: 1280 },
      { width: 1080, height: 1920, default: true },
      { width: 2160, height: 3840 },
      { width: 4320, height: 7680 }
    ]
  };

  const state = {
    images: [],
    targetWidth: 1024,
    targetHeight: 1024,
    lockAspect: true,
    processing: false,
    draggedId: null,
    installPrompt: null,
    processedResults: [],
    faceDetector: null,
    faceDetectorLoading: null,
    faceDetectorDelegate: null,
    faceDetectorStatus: 'idle',
    faceDetectorErrorShown: false,
    entryPreset: null,
    autoCropAfterUpload: false,
    ratioWidth: 1,
    ratioHeight: 1
  };

  const $ = (id) => document.getElementById(id);
  const dom = {
    dropZone: $('drop-zone'),
    mobileUploadSlot: $('mobile-upload-slot'),
    fileInput: $('file-input'),
    selectFiles: $('btn-select-files'),
    addMore: $('btn-add-more'),
    gallery: $('gallery-wrapper'),
    grid: $('image-grid'),
    imageCount: $('image-count'),
    totalSize: $('total-size'),
    width: $('resize-width'),
    height: $('resize-height'),
    lockAspect: $('lock-aspect'),
    aspectRatioCurrent: $('aspect-ratio-current'),
    format: $('output-format'),
    quality: $('output-quality'),
    qualityVal: $('quality-val'),
    qualityGroup: $('quality-group'),
    rename: $('rename-pattern'),
    zipName: $('zip-name'),
    zipNameGroup: $('zip-name-group'),
    datasetName: $('dataset-name'),
    triggerWord: $('trigger-word'),
    captionTemplate: $('caption-template'),
    generateTxt: $('generate-txt'),
    enableAiOptions: $('enable-ai-options'),
    aiOptionsPanel: $('ai-options-panel'),
    aiOptionContent: $('ai-option-content'),
    datasetExportSummary: $('dataset-export-summary'),
    captionSettings: $('caption-settings'),
    captionPreviewText: $('caption-preview-text'),
    summaryImageCount: $('summary-image-count'),
    summaryOutputSize: $('summary-output-size'),
    summaryFormat: $('summary-format'),
    summaryCaptions: $('summary-captions'),
    summaryEstimatedSize: $('summary-estimated-size'),
    outputPreviewList: $('output-preview-list'),
    completeImageCount: $('complete-image-count'),
    completeCaptionCount: $('complete-caption-count'),
    completeZipName: $('complete-zip-name'),
    completeTitle: $('complete-title'),
    completeDetail: $('complete-detail'),
    download: $('btn-download'),
    clear: $('btn-clear'),
    progress: $('progress-container'),
    progressBar: $('progress-bar'),
    progressStatus: $('progress-status'),
    recentSection: $('recent-section'),
    recentSizes: $('recent-sizes'),
    clearRecent: $('btn-clear-recent'),
    modal: $('complete-modal'),
    modalClose: $('btn-close-modal'),
    useAgain: $('btn-use-again'),
    bookmark: $('btn-bookmark'),
    bookmarkHelp: $('bookmark-help'),
    completeCount: $('complete-count'),
    toast: $('toast'),
    install: $('btn-install'),
    saveIndividual: $('save-individual'),
    saveZip: $('save-zip'),
    deviceRecommendation: $('device-recommendation'),
    mobileSaveSummary: $('mobile-save-summary'),
    processedImageList: $('processed-image-list'),
    shareAll: $('btn-share-all'),
    saveHelp: $('save-help'),
    smartCropAll: $('btn-smart-crop-all'),
    bottomProcessArea: $('bottom-process-area'),
    additionalDropOverlay: $('additional-drop-overlay'),
    presetOriginal: $('preset-original'),
    ratioSizePicker: $('ratio-size-picker'),
    ratioSizePickerPanel: $('ratio-size-picker-panel'),
    ratioSizePickerTitle: $('ratio-size-picker-title'),
    ratioSizeOptions: $('ratio-size-options')
  };

  let ratioPickerTrigger = null;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const resetInitialPhoneScroll = () => {
    if (window.matchMedia('(max-width: 720px)').matches && !window.location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  };

  window.addEventListener('pageshow', resetInitialPhoneScroll);
  document.addEventListener('DOMContentLoaded', () => {
    resetInitialPhoneScroll();
    init();
  });

  function init() {
    initializeResponsiveUploadPosition();
    restoreSettings();
    applyEntryPreset();
    syncPresetLanguage();
    bindUploadEvents();
    bindSettingEvents();
    bindDatasetEvents();
    initializeAiOptions();
    bindActionEvents();
    bindPasteEvent();
    bindAdStatusWatcher();
    bindPwaInstall();
    renderRecentSizes();
    initializeSaveMethod();
    syncSettingsUI();
    updateUI();
    registerServiceWorker();
  }

  function syncPresetLanguage() {
    const params = new URLSearchParams(window.location.search);
    const isEnglish = params.get('lang') === 'en' || document.documentElement.lang === 'en' || document.body.classList.contains('lang-en');
    if (dom.presetOriginal) {
      dom.presetOriginal.innerHTML = `<i class="fa-solid fa-rotate-left"></i> ${isEnglish ? 'Original image size' : '元画像サイズに戻す'}`;
    }
    const logo = document.querySelector('.logo-link');
if (logo) logo.href = isEnglish ? '/?lang=en' : '/';
  }

  function applyEntryPreset() {
    const params = new URLSearchParams(window.location.search);
    const preset = params.get('preset');
    const englishAiHome = params.get('lang') === 'en';
    if (preset !== 'ai-dataset' && !englishAiHome) return;

    state.entryPreset = preset;
    state.autoCropAfterUpload = true;
    state.targetWidth = 1024;
    state.targetHeight = 1024;
    state.lockAspect = true;
    setLockedRatio(1, 1);

    dom.width.value = '1024';
    dom.height.value = '1024';
    dom.lockAspect.checked = true;
    dom.format.value = 'image/jpeg';
    dom.quality.value = '95';
    dom.rename.value = 'swiftcrop_dataset_####';
    dom.zipName.value = 'swiftcrop_dataset';
    if (dom.enableAiOptions) dom.enableAiOptions.checked = true;
    if (dom.generateTxt) dom.generateTxt.checked = true;
    if (dom.captionTemplate) dom.captionTemplate.value = '{{dataset}}';
  }

  function initializeResponsiveUploadPosition() {
    if (!dom.mobileUploadSlot || !dom.dropZone || !dom.aiOptionsPanel || !dom.gallery || !dom.bottomProcessArea) return;

    const workspace = dom.gallery.parentElement;
    const desktopAnchor = workspace.querySelector('.comfort-section');
    const uploadAd = workspace.querySelector('.ad-slot-after-upload');
    const phoneLayout = window.matchMedia('(max-width: 720px)');

    const syncUploadPosition = () => {
      if (phoneLayout.matches) {
        // Show uploaded images and the Dataset ZIP action before the optional AI settings.
        const mobileOrder = [dom.dropZone, dom.gallery, dom.bottomProcessArea, dom.aiOptionsPanel, uploadAd].filter(Boolean);
        dom.mobileUploadSlot.append(...mobileOrder);
      } else {
        // Restore the desktop order inside the workspace.
        const desktopOrder = [dom.dropZone, dom.gallery, dom.bottomProcessArea, dom.aiOptionsPanel, uploadAd].filter(Boolean);
        desktopOrder.forEach((element) => workspace.insertBefore(element, desktopAnchor));
      }
    };

    syncUploadPosition();
    phoneLayout.addEventListener?.('change', syncUploadPosition);
  }

  function bindUploadEvents() {
    dom.selectFiles.addEventListener('click', () => dom.fileInput.click());
    dom.addMore.addEventListener('click', () => dom.fileInput.click());
    dom.fileInput.addEventListener('change', async (event) => {
      await addFiles(event.target.files);
      dom.fileInput.value = '';
    });

    dom.dropZone.addEventListener('click', (event) => {
      if (!event.target.closest('button')) dom.fileInput.click();
    });

    ['dragenter', 'dragover'].forEach((type) => {
      dom.dropZone.addEventListener(type, (event) => {
        event.preventDefault();
        dom.dropZone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach((type) => {
      dom.dropZone.addEventListener(type, (event) => {
        event.preventDefault();
        dom.dropZone.classList.remove('dragover');
      });
    });

    dom.dropZone.addEventListener('drop', (event) => addFiles(event.dataTransfer.files));

    let externalDragDepth = 0;

    const hasDraggedFiles = (event) =>
      Array.from(event.dataTransfer?.types || []).includes('Files');

    document.addEventListener('dragenter', (event) => {
      if (!hasDraggedFiles(event)) return;
      event.preventDefault();
      externalDragDepth += 1;

      if (state.images.length && dom.additionalDropOverlay) {
        dom.additionalDropOverlay.classList.add('is-visible');
        dom.additionalDropOverlay.setAttribute('aria-hidden', 'false');
      }
    });

    document.addEventListener('dragover', (event) => {
      if (!hasDraggedFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    });

    document.addEventListener('dragleave', (event) => {
      if (!hasDraggedFiles(event)) return;
      externalDragDepth = Math.max(0, externalDragDepth - 1);
      if (externalDragDepth === 0 && dom.additionalDropOverlay) {
        dom.additionalDropOverlay.classList.remove('is-visible');
        dom.additionalDropOverlay.setAttribute('aria-hidden', 'true');
      }
    });

    document.addEventListener('drop', async (event) => {
      if (!hasDraggedFiles(event)) return;
      event.preventDefault();
      externalDragDepth = 0;

      if (dom.additionalDropOverlay) {
        dom.additionalDropOverlay.classList.remove('is-visible');
        dom.additionalDropOverlay.setAttribute('aria-hidden', 'true');
      }

      // The original upload area already handles its own drop event.
      if (event.target.closest('#drop-zone')) return;

      const files = Array.from(event.dataTransfer?.files || []);
      if (!files.length) return;

      const beforeCount = state.images.length;
      await addFiles(files);
      const addedCount = state.images.length - beforeCount;

      if (addedCount > 0) {
        showToast(`${addedCount}枚の画像を追加しました`);
      }
    });
  }

  function bindPasteEvent() {
    document.addEventListener('paste', async (event) => {
      if (isTypingTarget(event.target)) return;
      const files = Array.from(event.clipboardData?.items || [])
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter(Boolean);

      if (!files.length) return;
      event.preventDefault();

      files.forEach((file, index) => {
        if (!file.name || file.name === 'image.png') {
          Object.defineProperty(file, 'name', {
            value: `clipboard_${Date.now()}_${index + 1}.png`,
            configurable: true
          });
        }
      });

      await addFiles(files);
      showToast(`${files.length}枚の画像を貼り付けました`);
    });
  }

  function bindSettingEvents() {
    dom.width.addEventListener('input', () => {
      const width = clampDimension(dom.width.value);
      if (!width) return;
      state.targetWidth = width;
      if (state.lockAspect) {
        const constrained = constrainedSizeFromWidth(width);
        state.targetWidth = constrained.width;
        state.targetHeight = constrained.height;
        dom.width.value = state.targetWidth;
        dom.height.value = state.targetHeight;
      }
      onSizeChanged();
    });

    dom.height.addEventListener('input', () => {
      const height = clampDimension(dom.height.value);
      if (!height) return;
      state.targetHeight = height;
      if (state.lockAspect) {
        const constrained = constrainedSizeFromHeight(height);
        state.targetWidth = constrained.width;
        state.targetHeight = constrained.height;
        dom.width.value = state.targetWidth;
        dom.height.value = state.targetHeight;
      }
      onSizeChanged();
    });

    dom.lockAspect.addEventListener('change', () => {
      state.lockAspect = dom.lockAspect.checked;
      if (state.lockAspect) setLockedRatio(state.targetWidth, state.targetHeight);
      updatePresetState();
      saveSettings();
    });

    document.querySelectorAll('.btn-ratio[data-ratio]').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.dataset.ratio === 'free') {
          closeRatioSizePicker(false);
          state.lockAspect = false;
          dom.lockAspect.checked = false;
          updatePresetState();
          saveSettings();
          return;
        }

        if (button.classList.contains('active')) {
          openRatioSizePicker(button);
          return;
        }

        const defaultSize = RATIO_SIZE_OPTIONS[button.dataset.ratio]?.find((option) => option.default);
        if (defaultSize) applyRatioSize(button.dataset.ratio, defaultSize.width, defaultSize.height);
      });
    });

    dom.ratioSizePicker?.querySelectorAll('[data-ratio-picker-close]').forEach((button) => {
      button.addEventListener('click', () => closeRatioSizePicker());
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && dom.ratioSizePicker && !dom.ratioSizePicker.hidden) {
        closeRatioSizePicker();
      }
    });
    window.addEventListener('resize', () => {
      if (dom.ratioSizePicker && !dom.ratioSizePicker.hidden) closeRatioSizePicker(false);
    });

    document.querySelectorAll('.btn-size-preset[data-w][data-h]').forEach((button) => {
      button.addEventListener('click', () => {
        const width = Number(button.dataset.w);
        const height = Number(button.dataset.h);
        state.lockAspect = true;
        dom.lockAspect.checked = true;
        setLockedRatio(width, height);
        setSize(width, height, true);
      });
    });

    dom.presetOriginal?.addEventListener('click', () => {
      const firstImage = state.images[0];
      if (!firstImage) {
        showToast('先に画像を追加してください', true);
        return;
      }
      if (state.lockAspect) setLockedRatio(firstImage.img.naturalWidth, firstImage.img.naturalHeight);
      const originalSize = fitDimensionsWithinLimit(firstImage.img.naturalWidth, firstImage.img.naturalHeight);
      setSize(originalSize.width, originalSize.height);
    });


    dom.format.addEventListener('change', () => {
      updateQualityVisibility();
      saveSettings();
    });

    dom.quality.addEventListener('input', () => {
      dom.qualityVal.textContent = `${dom.quality.value}%`;
      saveSettings();
    });

    [dom.rename, dom.zipName].forEach((input) => {
      input.addEventListener('input', saveSettings);
    });

    [dom.saveIndividual, dom.saveZip].forEach((radio) => {
      radio.addEventListener('change', () => {
        updateSaveMethodUI();
        saveSettings();
      });
    });

    dom.clearRecent.addEventListener('click', () => {
      localStorage.removeItem(RECENT_KEY);
      renderRecentSizes();
    });
  }

  function getDatasetBase() {
    return sanitizeFileName(dom.datasetName?.value.trim() || 'swiftcrop');
  }

  function getDatasetZipBase() {
    const raw = dom.datasetName?.value.trim();
    return raw ? `${sanitizeFileName(raw)}_dataset` : 'swiftcrop_images';
  }

  function getOutputExtension() {
    return dom.format.value === 'image/png' ? 'png' : dom.format.value === 'image/webp' ? 'webp' : 'jpg';
  }

  function initializeAiOptions() {
    if (!dom.enableAiOptions || !dom.aiOptionContent || !dom.aiOptionsPanel) return;

    const params = new URLSearchParams(window.location.search);
    const aiEntry = params.get('preset') === 'ai-dataset' || params.get('lang') === 'en';
    dom.enableAiOptions.checked = aiEntry;
    if (dom.generateTxt) dom.generateTxt.checked = aiEntry;

    const syncAiOptions = () => {
      const enabled = dom.enableAiOptions.checked;
      dom.aiOptionContent.hidden = !enabled;
      dom.aiOptionsPanel.classList.toggle('is-collapsed', !enabled);
      dom.aiOptionsPanel.classList.toggle('is-expanded', enabled);
      dom.aiOptionContent.querySelectorAll('input, textarea, select, button').forEach((control) => {
        control.disabled = !enabled;
      });
      updateDownloadButton();
      updateDatasetSummary();
    };

    dom.enableAiOptions.addEventListener('change', () => {
      syncAiOptions();
      if (state.images.length) renderGallery();
      saveSettings();
    });
    syncAiOptions();
  }

  function bindDatasetEvents() {
    if (!dom.datasetName) return;

    const syncDatasetNames = () => {
      const raw = dom.datasetName.value.trim();
      if (raw) dom.datasetName.value = sanitizeFileName(raw);
      const dataset = getDatasetBase();
      dom.rename.value = `${dataset}_####`;
      dom.zipName.value = getDatasetZipBase();
      updateDatasetSummary();
      saveSettings();
    };

    dom.datasetName.addEventListener('input', syncDatasetNames);
    dom.datasetName.addEventListener('change', syncDatasetNames);
    dom.triggerWord?.addEventListener('input', () => { updateDatasetSummary(); saveSettings(); });
    dom.captionTemplate?.addEventListener('input', () => { updateDatasetSummary(); saveSettings(); });
    dom.generateTxt?.addEventListener('change', () => {
      updateDatasetSummary();
      updateCaptionEditorsVisibility();
      saveSettings();
    });
    dom.zipName.addEventListener('input', updateDatasetSummary);
    dom.format.addEventListener('change', updateDatasetSummary);
    dom.width.addEventListener('input', updateDatasetSummary);
    dom.height.addEventListener('input', updateDatasetSummary);
    updateDatasetSummary();
  }

  function updateCaptionEditorsVisibility() {
    const visible = dom.enableAiOptions?.checked === true && dom.generateTxt?.checked === true;
    document.querySelectorAll('.card-caption-editor').forEach((editor) => {
      editor.classList.toggle('is-visible', visible);
      editor.setAttribute('aria-hidden', String(!visible));
      const input = editor.querySelector('textarea');
      if (input) input.tabIndex = visible ? 0 : -1;
    });
  }

  function updateDatasetSummary() {
    const dataset = getDatasetBase();
    const zipName = sanitizeFileName(dom.zipName.value.trim() || getDatasetZipBase());
    const aiEnabled = dom.enableAiOptions?.checked === true;
    const captions = aiEnabled && dom.generateTxt?.checked === true;
    const ext = getOutputExtension();
    const count = state.images.length;
    const totalInput = state.images.reduce((sum, item) => sum + item.size, 0);
    const estimated = Math.max(0, totalInput * (dom.format.value === 'image/png' ? 1.15 : 0.72));
    const previewItem = state.images[0] || { name: `${dataset}_0001.${ext}`, captionText: '' };
    const caption = buildCaption(previewItem, 0, `${dataset}_0001.${ext}`) || dataset;

    if (dom.datasetExportSummary) dom.datasetExportSummary.textContent = `${zipName}.zip`;
    if (dom.captionSettings) dom.captionSettings.hidden = !captions;
    if (dom.captionPreviewText) dom.captionPreviewText.textContent = caption;
    if (dom.summaryImageCount) dom.summaryImageCount.textContent = String(count);
    if (dom.summaryOutputSize) dom.summaryOutputSize.textContent = `${state.targetWidth} × ${state.targetHeight}`;
    if (dom.summaryFormat) dom.summaryFormat.textContent = ext.toUpperCase();
    if (dom.summaryCaptions) dom.summaryCaptions.textContent = captions ? 'Enabled' : 'Disabled';
    if (dom.summaryEstimatedSize) dom.summaryEstimatedSize.textContent = count ? `≈ ${formatBytes(estimated)}` : '0 MB';
    if (dom.outputPreviewList) {
      const lines = [];
      for (let index = 1; index <= 2; index += 1) {
        const number = String(index).padStart(4, '0');
        lines.push(`${dataset}_${number}.${ext}`);
        if (captions) lines.push(`${dataset}_${number}.txt`);
      }
      dom.outputPreviewList.textContent = lines.join('\n');
    }
  }

  function replaceTemplateToken(text, token, value) {
    return text.split(`{{${token}}}`).join(value).split(`{${token}}`).join(value);
  }

  function buildCaption(item, index, outputName) {
    let template = dom.captionTemplate?.value.trim() || '{{dataset}}';
    const sourceBase = item.name.replace(/\.[^.]+$/, '');
    const outputBase = outputName.replace(/\.[^.]+$/, '');
    const dataset = getDatasetBase();
    template = replaceTemplateToken(template, 'filename', sourceBase);
    template = replaceTemplateToken(template, 'output', outputBase);
    template = replaceTemplateToken(template, 'index', String(index + 1));
    template = replaceTemplateToken(template, 'dataset', dataset);
    const parts = [dom.triggerWord?.value.trim(), template.trim(), item.captionText?.trim()]
      .filter(Boolean)
      .filter((part, partIndex, values) => values.indexOf(part) === partIndex);
    return parts.join(', ');
  }

  function bindActionEvents() {
    dom.download.addEventListener('click', processAndDownload);
    dom.clear.addEventListener('click', clearAllImages);
    dom.modalClose.addEventListener('click', closeModal);
    dom.modal.addEventListener('click', (event) => {
      if (event.target === dom.modal) closeModal();
    });
    dom.useAgain.addEventListener('click', () => {
      closeModal();
      clearAllImages();
      dom.fileInput.click();
    });
    dom.bookmark.addEventListener('click', () => {
      dom.bookmarkHelp.hidden = !dom.bookmarkHelp.hidden;
    });
    dom.shareAll.addEventListener('click', shareAllProcessedImages);
    dom.smartCropAll?.addEventListener('click', smartCropAllImages);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !dom.modal.hidden) closeModal();
    });
  }

  async function addFiles(fileList) {
    const files = Array.from(fileList || []).filter((file) => SUPPORTED_TYPES.has(file.type));
    if (!files.length) {
      showToast('JPEG・PNG・WebP画像を選択してください', true);
      return;
    }

    showProgress(0, `画像を読み込み中… 0/${files.length}`);
    let loaded = 0;

    for (const file of files) {
      try {
        const image = await loadImage(file);
        state.images.push(image);
        loaded += 1;
        showProgress(Math.round((loaded / files.length) * 100), `画像を読み込み中… ${loaded}/${files.length}`);
      } catch (error) {
        console.error(error);
        showToast(`${file.name}を読み込めませんでした`, true);
      }
    }

    hideProgressSoon(300);
    renderGallery();
    updateUI();

    if (state.autoCropAfterUpload && loaded > 0) {
      await smartCropAllImages();
    }
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({
        id: crypto.randomUUID ? crypto.randomUUID() : `img_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        file,
        name: file.name,
        src: url,
        img,
        cropX: 50,
        cropY: 50,
        zoom: 1,
        size: file.size,
        aspectRatio: img.naturalWidth / img.naturalHeight,
        origDimStr: `${img.naturalWidth} × ${img.naturalHeight} px`,
        captionText: '',
        autoCropResult: null
      });
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`Failed to decode ${file.name}`));
      };
      img.src = url;
    });
  }

  function renderGallery() {
    dom.grid.innerHTML = '';

    state.images.forEach((item, index) => {
      const card = document.createElement('article');
      card.className = 'image-card';
      card.dataset.id = item.id;
      // 並び替えはハンドル操作時だけ有効にする。
      // 常時 draggable にすると、Caption の文字選択がカードのドラッグとして扱われることがある。
      card.draggable = false;

      const toolbar = document.createElement('div');
      toolbar.className = 'card-toolbar';

      const dragHandle = document.createElement('button');
      dragHandle.type = 'button';
      dragHandle.className = 'drag-handle';
      dragHandle.title = 'ドラッグして並び替え';
      dragHandle.setAttribute('aria-label', `${item.name}を並び替え`);
      dragHandle.innerHTML = '<i class="fa-solid fa-grip-vertical"></i>';
      dragHandle.addEventListener('pointerdown', () => { card.draggable = true; });
      dragHandle.addEventListener('pointerup', () => { card.draggable = false; });
      dragHandle.addEventListener('pointercancel', () => { card.draggable = false; });

      const order = document.createElement('span');
      order.className = 'card-order';
      order.textContent = String(index + 1).padStart(2, '0');

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn-delete-card';
      remove.title = '画像を削除';
      remove.setAttribute('aria-label', `${item.name}を削除`);
      remove.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      remove.addEventListener('click', () => deleteImage(item.id));

      toolbar.append(order, dragHandle, remove);

      const frame = document.createElement('div');
      frame.className = 'crop-frame-container';

      const viewport = document.createElement('div');
      viewport.className = 'crop-viewport';
      viewport.style.aspectRatio = `${state.targetWidth} / ${state.targetHeight}`;
      viewport.title = 'ドラッグで位置調整・ホイールでズーム・ダブルクリックでリセット';

      const img = document.createElement('img');
      img.className = 'crop-image';
      img.src = item.src;
      img.alt = item.name;
      img.draggable = false;

      const gridGuide = document.createElement('div');
      gridGuide.className = 'crop-guide';
      gridGuide.setAttribute('aria-hidden', 'true');

      const zoomLabel = document.createElement('span');
      zoomLabel.className = 'zoom-label';
      zoomLabel.textContent = `${item.zoom.toFixed(2)}×`;

      viewport.append(img, gridGuide, zoomLabel);
      frame.append(viewport);

      const details = document.createElement('div');
      details.className = 'card-details';
      details.innerHTML = `
        <div class="card-title" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
        <div class="card-meta">
          <span>${item.origDimStr}</span>
          <span>${formatBytes(item.size)}</span>
        </div>
      `;

      const captionEditor = document.createElement('label');
      captionEditor.className = 'card-caption-editor';
      const captionVisible = dom.enableAiOptions?.checked === true && dom.generateTxt?.checked === true;
      captionEditor.classList.toggle('is-visible', captionVisible);
      captionEditor.setAttribute('aria-hidden', String(!captionVisible));
      const captionLabel = document.createElement('span');
      captionLabel.textContent = document.documentElement.lang === 'en' ? 'Image caption' : '画像ごとのCaption';
      const captionInput = document.createElement('textarea');
      captionInput.rows = 2;
      captionInput.maxLength = 2000;
      captionInput.value = item.captionText || '';
      captionInput.tabIndex = captionVisible ? 0 : -1;
      captionInput.placeholder = document.documentElement.lang === 'en'
        ? 'e.g. smiling, outdoors, blue shirt'
        : '例：smiling, outdoors, blue shirt';
      captionInput.setAttribute('aria-label', `${item.name} caption`);
      captionInput.addEventListener('input', () => {
        item.captionText = captionInput.value;
        updateDatasetSummary();
      });
      captionInput.addEventListener('pointerdown', (event) => {
        card.draggable = false;
        event.stopPropagation();
      });
      captionInput.addEventListener('mousedown', (event) => event.stopPropagation());
      captionInput.addEventListener('touchstart', (event) => event.stopPropagation(), { passive: true });
      captionInput.addEventListener('dragstart', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      captionEditor.append(captionLabel, captionInput);

      card.append(toolbar, frame, details, captionEditor);
      dom.grid.append(card);

      bindCropControls(viewport, img, zoomLabel, item);
      bindCardSorting(card);

      requestAnimationFrame(() => {
        updateViewportSize(viewport);
        updatePreview(viewport, img, zoomLabel, item);
      });
    });

    updateGallerySummary();
  }

  function bindCardSorting(card) {
    card.addEventListener('dragstart', (event) => {
      if (event.target.closest('textarea, input, button')) {
        event.preventDefault();
        return;
      }
      state.draggedId = card.dataset.id;
      card.classList.add('is-sorting');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', state.draggedId);
    });

    card.addEventListener('dragend', () => {
      card.draggable = false;
      state.draggedId = null;
      document.querySelectorAll('.image-card').forEach((el) => {
        el.classList.remove('is-sorting', 'sort-before', 'sort-after');
      });
    });

    card.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (!state.draggedId || state.draggedId === card.dataset.id) return;
      const rect = card.getBoundingClientRect();
      const before = event.clientY < rect.top + rect.height / 2;
      card.classList.toggle('sort-before', before);
      card.classList.toggle('sort-after', !before);
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('sort-before', 'sort-after');
    });

    card.addEventListener('drop', (event) => {
      event.preventDefault();
      const fromId = state.draggedId || event.dataTransfer.getData('text/plain');
      const toId = card.dataset.id;
      const fromIndex = state.images.findIndex((item) => item.id === fromId);
      const toIndex = state.images.findIndex((item) => item.id === toId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

      const rect = card.getBoundingClientRect();
      const insertAfter = event.clientY >= rect.top + rect.height / 2;
      const [moved] = state.images.splice(fromIndex, 1);
      let destination = state.images.findIndex((item) => item.id === toId);
      if (insertAfter) destination += 1;
      state.images.splice(destination, 0, moved);
      renderGallery();
      showToast('画像の順番を変更しました');
    });
  }

  function bindCropControls(viewport, img, zoomLabel, item) {
    const pointers = new Map();
    let mode = null;
    let dragPointerId = null;
    let dragStart = null;
    let pinchStart = null;
    let raf = null;

    const queue = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        updatePreview(viewport, img, zoomLabel, item);
      });
    };

    const pointFromEvent = (event) => ({
      x: event.clientX,
      y: event.clientY
    });

    const midpoint = (a, b) => ({
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2
    });

    const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

    const viewportPoint = (clientPoint) => {
      const rect = viewport.getBoundingClientRect();
      return {
        x: clientPoint.x - rect.left,
        y: clientPoint.y - rect.top
      };
    };

    const beginDrag = (pointerId, point) => {
      mode = 'drag';
      dragPointerId = pointerId;
      dragStart = {
        point,
        cropX: item.cropX,
        cropY: item.cropY
      };
      pinchStart = null;
      viewport.classList.add('is-dragging');
    };

    const beginPinch = () => {
      const entries = Array.from(pointers.entries()).slice(0, 2);
      if (entries.length < 2) return;

      const [first, second] = entries;
      const centerClient = midpoint(first[1], second[1]);
      const center = viewportPoint(centerClient);
      const metrics = previewMetrics(viewport, item);
      if (!metrics) return;

      const imageLeft = -metrics.overflowX * item.cropX / 100;
      const imageTop = -metrics.overflowY * item.cropY / 100;

      mode = 'pinch';
      dragPointerId = null;
      dragStart = null;
      pinchStart = {
        ids: [first[0], second[0]],
        distance: Math.max(1, distance(first[1], second[1])),
        zoom: item.zoom,
        center,
        sourceX: clamp((center.x - imageLeft) / metrics.renderedWidth, 0, 1),
        sourceY: clamp((center.y - imageTop) / metrics.renderedHeight, 0, 1)
      };
      viewport.classList.add('is-dragging');
    };

    const updateDrag = (point) => {
      if (!dragStart) return;
      const metrics = previewMetrics(viewport, item);
      if (!metrics) return;

      const dx = point.x - dragStart.point.x;
      const dy = point.y - dragStart.point.y;

      if (metrics.overflowX > 0.5) {
        item.cropX = clamp(
          dragStart.cropX - dx / metrics.overflowX * 100,
          0,
          100
        );
      }

      if (metrics.overflowY > 0.5) {
        item.cropY = clamp(
          dragStart.cropY - dy / metrics.overflowY * 100,
          0,
          100
        );
      }

      queue();
    };

    const updatePinch = () => {
      if (!pinchStart) return;
      const [firstId, secondId] = pinchStart.ids;
      const first = pointers.get(firstId);
      const second = pointers.get(secondId);
      if (!first || !second) return;

      const currentDistance = Math.max(1, distance(first, second));
      item.zoom = clamp(
        pinchStart.zoom * (currentDistance / pinchStart.distance),
        1,
        4
      );

      const center = viewportPoint(midpoint(first, second));
      const metrics = previewMetrics(viewport, item);
      if (!metrics) return;

      const desiredLeft = center.x - pinchStart.sourceX * metrics.renderedWidth;
      const desiredTop = center.y - pinchStart.sourceY * metrics.renderedHeight;

      item.cropX = metrics.overflowX > 0.5
        ? clamp(-desiredLeft / metrics.overflowX * 100, 0, 100)
        : 50;

      item.cropY = metrics.overflowY > 0.5
        ? clamp(-desiredTop / metrics.overflowY * 100, 0, 100)
        : 50;

      queue();
    };

    viewport.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      pointers.set(event.pointerId, pointFromEvent(event));
      viewport.setPointerCapture(event.pointerId);

      if (pointers.size === 1) {
        beginDrag(event.pointerId, pointers.get(event.pointerId));
      } else if (pointers.size >= 2) {
        beginPinch();
      }

      event.preventDefault();
    });

    viewport.addEventListener('pointermove', (event) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, pointFromEvent(event));

      if (mode === 'pinch' && pointers.size >= 2) {
        updatePinch();
      } else if (
        mode === 'drag' &&
        pointers.size === 1 &&
        event.pointerId === dragPointerId
      ) {
        updateDrag(pointers.get(event.pointerId));
      }

      event.preventDefault();
    });

    const finishPointer = (event) => {
      pointers.delete(event.pointerId);

      if (viewport.hasPointerCapture(event.pointerId)) {
        viewport.releasePointerCapture(event.pointerId);
      }

      if (pointers.size >= 2) {
        beginPinch();
      } else if (pointers.size === 1) {
        const [remainingId, remainingPoint] = pointers.entries().next().value;
        beginDrag(remainingId, remainingPoint);
      } else {
        mode = null;
        dragPointerId = null;
        dragStart = null;
        pinchStart = null;
        viewport.classList.remove('is-dragging');
      }
    };

    viewport.addEventListener('pointerup', finishPointer);
    viewport.addEventListener('pointercancel', finishPointer);
    viewport.addEventListener('lostpointercapture', (event) => {
      if (pointers.has(event.pointerId)) finishPointer(event);
    });

    viewport.addEventListener('wheel', (event) => {
      event.preventDefault();

      const oldMetrics = previewMetrics(viewport, item);
      if (!oldMetrics) return;

      const rect = viewport.getBoundingClientRect();
      const center = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
      const oldLeft = -oldMetrics.overflowX * item.cropX / 100;
      const oldTop = -oldMetrics.overflowY * item.cropY / 100;
      const sourceX = clamp((center.x - oldLeft) / oldMetrics.renderedWidth, 0, 1);
      const sourceY = clamp((center.y - oldTop) / oldMetrics.renderedHeight, 0, 1);

      const zoomSensitivity = event.shiftKey ? 0.0003 : 0.0015;
      item.zoom = clamp(item.zoom * Math.exp(-event.deltaY * zoomSensitivity), 1, 4);

      const newMetrics = previewMetrics(viewport, item);
      if (!newMetrics) return;

      const desiredLeft = center.x - sourceX * newMetrics.renderedWidth;
      const desiredTop = center.y - sourceY * newMetrics.renderedHeight;

      item.cropX = newMetrics.overflowX > 0.5
        ? clamp(-desiredLeft / newMetrics.overflowX * 100, 0, 100)
        : 50;

      item.cropY = newMetrics.overflowY > 0.5
        ? clamp(-desiredTop / newMetrics.overflowY * 100, 0, 100)
        : 50;

      queue();
    }, { passive: false });

    viewport.addEventListener('dblclick', (event) => {
      item.cropX = 50;
      item.cropY = 50;
      item.zoom = 1;
      queue();
      event.preventDefault();
    });
  }

  async function createFaceDetector(delegate) {
    const module = await import('./assets/mediapipe/vision_bundle.mjs');
    const vision = await module.FilesetResolver.forVisionTasks(
      './assets/mediapipe/wasm'
    );

    return module.FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite',
        delegate
      },
      runningMode: 'IMAGE',
      minDetectionConfidence: 0.30,
      minSuppressionThreshold: 0.30
    });
  }

  async function loadFaceDetector() {
    if (state.faceDetector) return state.faceDetector;
    if (state.faceDetectorLoading) return state.faceDetectorLoading;

    state.faceDetectorStatus = 'loading';

    state.faceDetectorLoading = (async () => {
      try {
        state.faceDetector = await createFaceDetector('GPU');
        state.faceDetectorDelegate = 'GPU';
      } catch (gpuError) {
        console.warn('GPU face detector failed. Retrying with CPU.', gpuError);
        state.faceDetector = await createFaceDetector('CPU');
        state.faceDetectorDelegate = 'CPU';
      }

      state.faceDetectorStatus = 'ready';
      return state.faceDetector;
    })().catch((error) => {
      state.faceDetector = null;
      state.faceDetectorDelegate = null;
      state.faceDetectorStatus = 'failed';

      if (!state.faceDetectorErrorShown) {
        state.faceDetectorErrorShown = true;
      }

      throw error;
    }).finally(() => {
      state.faceDetectorLoading = null;
    });

    return state.faceDetectorLoading;
  }


  function detectFaces(detector, image) {
    const result = detector.detect(image);
    return (result?.detections || []).filter((detection) => {
      const box = detection.boundingBox;
      return box && box.width >= 8 && box.height >= 8;
    });
  }

  async function smartCropImage(item, silent = false) {
    let focus = null;
    let resultInfo = null;

    try {
      const detector = await loadFaceDetector();
      const detections = detectFaces(detector, item.img);
      if (detections.length) {
        focus = unionFaceBoxes(detections, item.img.naturalWidth, item.img.naturalHeight);
        const count = detections.length;
        resultInfo = {
          type: 'face',
          count,
          label: count > 1 ? `顔を${count}人検出` : '顔を検出',
          delegate: state.faceDetectorDelegate
        };
      }
    } catch (error) {
      console.warn('Face detection unavailable; using normal auto adjustment.', error);
    }

    if (!focus) {
      focus = estimateVisualFocus(item.img);
      resultInfo = {
        type: 'visual',
        count: 0,
        label: '自動調整',
        delegate: null,
        detectorStatus: state.faceDetectorStatus
      };
    }

    applyFocusCrop(item, focus);
    item.autoCropResult = resultInfo;

    const card = dom.grid.querySelector(`[data-id="${item.id}"]`);
    const viewport = card?.querySelector('.crop-viewport');
    const image = card?.querySelector('.crop-image');
    const zoom = card?.querySelector('.zoom-label');
    if (viewport && image && zoom) updatePreview(viewport, image, zoom, item);

    if (!silent) {
      showToast('自動調整しました');
    }

    return resultInfo;
  }

  async function smartCropAllImages() {
    if (!state.images.length || state.processing) return;
    dom.smartCropAll.disabled = true;
    const original = dom.smartCropAll.innerHTML;
    const showDetailedProgress = state.images.length >= 10;
    dom.smartCropAll.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 顔を確認中…';

    if (showDetailedProgress) {
      showProgress(0, `画像を調整しています… 0/${state.images.length}`);
    }

    let faceImages = 0;
    let visualImages = 0;
    let totalFaces = 0;

    try {
      for (let i = 0; i < state.images.length; i += 1) {
        const result = await smartCropImage(state.images[i], true);
        if (result.type === 'face') {
          faceImages += 1;
          totalFaces += result.count;
        } else {
          visualImages += 1;
        }

        if (showDetailedProgress) {
          showProgress(
            Math.round(((i + 1) / state.images.length) * 100),
            `画像を調整しています… ${i + 1}/${state.images.length}`
          );
        }
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      if (state.faceDetectorStatus !== 'failed') {
        showToast('自動調整が完了しました');
      }
    } catch (error) {
      console.error('Smart crop failed.', error);
      showToast('自動調整中にエラーが発生しました', true);
    } finally {
      if (showDetailedProgress) hideProgressSoon(350);
      dom.smartCropAll.innerHTML = original;
      dom.smartCropAll.disabled = !state.images.length;
    }
  }

  function unionFaceBoxes(detections, imageWidth, imageHeight) {
    const boxes = detections.map((detection) => detection.boundingBox).filter(Boolean);
    const left = Math.min(...boxes.map((box) => box.originX));
    const top = Math.min(...boxes.map((box) => box.originY));
    const right = Math.max(...boxes.map((box) => box.originX + box.width));
    const bottom = Math.max(...boxes.map((box) => box.originY + box.height));
    const width = right - left;
    const height = bottom - top;

    return {
      x: clamp(left, 0, imageWidth),
      y: clamp(top, 0, imageHeight),
      width: Math.min(imageWidth, width),
      height: Math.min(imageHeight, height),
      faceBias: true,
      faceCount: boxes.length
    };
  }

  function estimateVisualFocus(image) {
    const sample = document.createElement('canvas');
    const maxSide = 192;
    const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    sample.width = Math.max(24, Math.round(image.naturalWidth * ratio));
    sample.height = Math.max(24, Math.round(image.naturalHeight * ratio));
    const ctx = sample.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, sample.width, sample.height);
    const { data } = ctx.getImageData(0, 0, sample.width, sample.height);
    let total = 0;
    let weightedX = 0;
    let weightedY = 0;

    const luminance = (x, y) => {
      const i = (y * sample.width + x) * 4;
      return data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
    };

    for (let y = 1; y < sample.height - 1; y += 2) {
      for (let x = 1; x < sample.width - 1; x += 2) {
        const gx = Math.abs(luminance(x + 1, y) - luminance(x - 1, y));
        const gy = Math.abs(luminance(x, y + 1) - luminance(x, y - 1));
        const centerPrior = 0.6 + 0.4 * (1 - Math.hypot(x / sample.width - 0.5, y / sample.height - 0.45) / 0.72);
        const weight = Math.max(0.01, (gx + gy) * centerPrior);
        total += weight;
        weightedX += x * weight;
        weightedY += y * weight;
      }
    }

    const cx = total ? weightedX / total / sample.width * image.naturalWidth : image.naturalWidth / 2;
    const cy = total ? weightedY / total / sample.height * image.naturalHeight : image.naturalHeight / 2;
    return {
      x: clamp(cx - image.naturalWidth * 0.22, 0, image.naturalWidth),
      y: clamp(cy - image.naturalHeight * 0.22, 0, image.naturalHeight),
      width: image.naturalWidth * 0.44,
      height: image.naturalHeight * 0.44,
      faceBias: false
    };
  }

  function applyFocusCrop(item, focus) {
    const imageWidth = item.img.naturalWidth;
    const imageHeight = item.img.naturalHeight;
    const targetRatio = state.targetWidth / state.targetHeight;

    let baseCropWidth;
    let baseCropHeight;
    if (imageWidth / imageHeight > targetRatio) {
      baseCropHeight = imageHeight;
      baseCropWidth = imageHeight * targetRatio;
    } else {
      baseCropWidth = imageWidth;
      baseCropHeight = imageWidth / targetRatio;
    }

    const focusCenterX = clamp(focus.x + focus.width / 2, 0, imageWidth);
    const focusCenterY = clamp(focus.y + focus.height / 2, 0, imageHeight);

    if (focus.faceBias) {
      const faceCount = Math.max(1, focus.faceCount || 1);
      const desiredFaceHeightRatio = faceCount === 1 ? 0.36 : 0.48;
      const horizontalPadding = faceCount === 1 ? 1.8 : 1.35;

      let cropHeight = focus.height / desiredFaceHeightRatio;
      let cropWidth = cropHeight * targetRatio;

      const minimumWidthForFaces = focus.width * horizontalPadding;
      if (cropWidth < minimumWidthForFaces) {
        cropWidth = minimumWidthForFaces;
        cropHeight = cropWidth / targetRatio;
      }

      cropWidth = Math.min(baseCropWidth, cropWidth);
      cropHeight = Math.min(baseCropHeight, cropHeight);

      const zoomFromWidth = baseCropWidth / cropWidth;
      const zoomFromHeight = baseCropHeight / cropHeight;
      item.zoom = clamp(
        Math.min(zoomFromWidth, zoomFromHeight),
        1.12,
        faceCount === 1 ? 4 : 3.2
      );

      cropWidth = baseCropWidth / item.zoom;
      cropHeight = baseCropHeight / item.zoom;

      const faceAnchorY = 0.39;
      const cropLeft = clamp(
        focusCenterX - cropWidth / 2,
        0,
        Math.max(0, imageWidth - cropWidth)
      );
      const cropTop = clamp(
        focusCenterY - cropHeight * faceAnchorY,
        0,
        Math.max(0, imageHeight - cropHeight)
      );

      item.cropX = imageWidth > cropWidth
        ? cropLeft / (imageWidth - cropWidth) * 100
        : 50;
      item.cropY = imageHeight > cropHeight
        ? cropTop / (imageHeight - cropHeight) * 100
        : 50;
      return;
    }

    const paddedWidth = Math.min(imageWidth, focus.width * 1.35);
    const paddedHeight = Math.min(imageHeight, focus.height * 1.35);
    const requiredCropWidth = Math.max(paddedWidth, paddedHeight * targetRatio);
    const requiredCropHeight = requiredCropWidth / targetRatio;
    const zoomFromWidth = baseCropWidth / requiredCropWidth;
    const zoomFromHeight = baseCropHeight / requiredCropHeight;

    item.zoom = clamp(Math.min(zoomFromWidth, zoomFromHeight), 1, 2.6);
    const cropWidth = baseCropWidth / item.zoom;
    const cropHeight = baseCropHeight / item.zoom;
    const cropLeft = clamp(
      focusCenterX - cropWidth / 2,
      0,
      Math.max(0, imageWidth - cropWidth)
    );
    const cropTop = clamp(
      focusCenterY - cropHeight / 2,
      0,
      Math.max(0, imageHeight - cropHeight)
    );

    item.cropX = imageWidth > cropWidth
      ? cropLeft / (imageWidth - cropWidth) * 100
      : 50;
    item.cropY = imageHeight > cropHeight
      ? cropTop / (imageHeight - cropHeight) * 100
      : 50;
  }

  function previewMetrics(viewport, item) {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    if (!width || !height) return null;
    const scale = Math.max(width / item.img.naturalWidth, height / item.img.naturalHeight);
    const renderedWidth = item.img.naturalWidth * scale * item.zoom;
    const renderedHeight = item.img.naturalHeight * scale * item.zoom;
    return {
      width,
      height,
      renderedWidth,
      renderedHeight,
      overflowX: Math.max(0, renderedWidth - width),
      overflowY: Math.max(0, renderedHeight - height)
    };
  }

  function updatePreview(viewport, img, zoomLabel, item) {
    const metrics = previewMetrics(viewport, item);
    if (!metrics) return;
    const x = -metrics.overflowX * item.cropX / 100;
    const y = -metrics.overflowY * item.cropY / 100;
    img.style.width = `${metrics.renderedWidth}px`;
    img.style.height = `${metrics.renderedHeight}px`;
    img.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    zoomLabel.textContent = `${item.zoom.toFixed(2)}×`;
  }

  function updateViewportSize(viewport) {
    const frame = viewport.parentElement;
    const ratio = state.targetWidth / state.targetHeight;
    const width = frame.clientWidth;
    const maxHeight = 420;
    viewport.style.aspectRatio = `${state.targetWidth} / ${state.targetHeight}`;
    viewport.style.width = width > 0 && width / ratio > maxHeight ? `${maxHeight * ratio}px` : '100%';
  }

  function updateGalleryLayout() {
    document.querySelectorAll('.crop-viewport').forEach((viewport) => {
      updateViewportSize(viewport);
      const item = state.images.find((entry) => entry.id === viewport.closest('.image-card')?.dataset.id);
      const img = viewport.querySelector('.crop-image');
      const zoom = viewport.querySelector('.zoom-label');
      if (item && img && zoom) updatePreview(viewport, img, zoom, item);
    });
  }

  function deleteImage(id) {
    const index = state.images.findIndex((item) => item.id === id);
    if (index < 0) return;
    URL.revokeObjectURL(state.images[index].src);
    state.images.splice(index, 1);
    renderGallery();
    updateUI();
  }

  function clearAllImages() {
    clearProcessedResults();
    state.images.forEach((item) => URL.revokeObjectURL(item.src));
    state.images = [];
    dom.grid.innerHTML = '';
    updateUI();
  }

  function onSizeChanged() {
    state.targetWidth = clampDimension(dom.width.value) || state.targetWidth;
    state.targetHeight = clampDimension(dom.height.value) || state.targetHeight;
    updatePresetState();
    updateGalleryLayout();
    saveSettings();
  }

  function setSize(width, height, remember = false) {
    state.targetWidth = clamp(width, 1, MAX_DIMENSION);
    state.targetHeight = clamp(height, 1, MAX_DIMENSION);
    dom.width.value = state.targetWidth;
    dom.height.value = state.targetHeight;
    updatePresetState();
    updateGalleryLayout();
    saveSettings();
    if (remember) addRecentSize(state.targetWidth, state.targetHeight);
  }
  function syncSettingsUI() {
    dom.width.value = state.targetWidth;
    dom.height.value = state.targetHeight;
    dom.lockAspect.checked = state.lockAspect;
    updatePresetState();
    updateQualityVisibility();
    dom.qualityVal.textContent = `${dom.quality.value}%`;
  }

  function greatestCommonDivisor(left, right) {
    let a = Math.abs(Math.round(left));
    let b = Math.abs(Math.round(right));
    while (b) {
      [a, b] = [b, a % b];
    }
    return a || 1;
  }

  function setLockedRatio(width, height) {
    const safeWidth = Number.isFinite(Number(width)) && Number(width) > 0 ? Math.round(Number(width)) : 1;
    const safeHeight = Number.isFinite(Number(height)) && Number(height) > 0 ? Math.round(Number(height)) : 1;
    const divisor = greatestCommonDivisor(safeWidth, safeHeight);
    state.ratioWidth = safeWidth / divisor;
    state.ratioHeight = safeHeight / divisor;
  }

  function lockedRatioValue() {
    return state.ratioHeight > 0 ? state.ratioWidth / state.ratioHeight : 1;
  }

  function applyRatioSize(ratio, width, height) {
    const [ratioWidth, ratioHeight] = ratio.split(':').map(Number);
    state.lockAspect = true;
    dom.lockAspect.checked = true;
    setLockedRatio(ratioWidth, ratioHeight);
    setSize(width, height);
  }

  function openRatioSizePicker(trigger) {
    if (!dom.ratioSizePicker || !dom.ratioSizePickerPanel || !dom.ratioSizeOptions) return;
    const ratio = trigger.dataset.ratio;
    const options = RATIO_SIZE_OPTIONS[ratio];
    if (!options?.length) return;

    if (ratioPickerTrigger && ratioPickerTrigger !== trigger) ratioPickerTrigger.setAttribute('aria-expanded', 'false');
    ratioPickerTrigger = trigger;
    trigger.setAttribute('aria-expanded', 'true');
    dom.ratioSizePickerTitle.textContent = `${ratio}のサイズ`;
    dom.ratioSizeOptions.innerHTML = '';

    options.forEach((option) => {
      const current = option.width === state.targetWidth && option.height === state.targetHeight;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `ratio-size-option${current ? ' is-current' : ''}`;
      button.setAttribute('aria-pressed', String(current));
      button.innerHTML = `<i class="fa-solid fa-check" aria-hidden="true"></i><strong>${option.width} × ${option.height}</strong><small>${option.default ? '標準' : ''}</small>`;
      button.addEventListener('click', () => {
        applyRatioSize(ratio, option.width, option.height);
        closeRatioSizePicker();
      });
      dom.ratioSizeOptions.append(button);
    });

    dom.ratioSizePicker.hidden = false;
    document.body.classList.add('ratio-size-picker-open');
    positionRatioSizePicker(trigger);
    window.setTimeout(() => {
      dom.ratioSizeOptions.querySelector('.is-current, .ratio-size-option')?.focus();
    }, 0);
  }

  function positionRatioSizePicker(trigger) {
    if (!dom.ratioSizePickerPanel) return;
    dom.ratioSizePickerPanel.style.removeProperty('top');
    dom.ratioSizePickerPanel.style.removeProperty('left');
    if (window.matchMedia('(max-width: 720px)').matches) return;

    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = dom.ratioSizePickerPanel.getBoundingClientRect();
    const margin = 12;
    const left = clamp(triggerRect.left, margin, window.innerWidth - panelRect.width - margin);
    const below = triggerRect.bottom + 8;
    const top = below + panelRect.height <= window.innerHeight - margin
      ? below
      : Math.max(margin, triggerRect.top - panelRect.height - 8);
    dom.ratioSizePickerPanel.style.left = `${left}px`;
    dom.ratioSizePickerPanel.style.top = `${top}px`;
  }

  function closeRatioSizePicker(restoreFocus = true) {
    if (!dom.ratioSizePicker || dom.ratioSizePicker.hidden) return;
    dom.ratioSizePicker.hidden = true;
    document.body.classList.remove('ratio-size-picker-open');
    if (ratioPickerTrigger) {
      ratioPickerTrigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus) ratioPickerTrigger.focus();
    }
    ratioPickerTrigger = null;
  }

  function constrainedSizeFromWidth(width) {
    let safeWidth = clamp(width, 1, MAX_DIMENSION);
    let safeHeight = Math.max(1, Math.round(safeWidth / lockedRatioValue()));
    if (safeHeight > MAX_DIMENSION) {
      safeHeight = MAX_DIMENSION;
      safeWidth = Math.max(1, Math.round(safeHeight * lockedRatioValue()));
    }
    return { width: safeWidth, height: safeHeight };
  }

  function constrainedSizeFromHeight(height) {
    let safeHeight = clamp(height, 1, MAX_DIMENSION);
    let safeWidth = Math.max(1, Math.round(safeHeight * lockedRatioValue()));
    if (safeWidth > MAX_DIMENSION) {
      safeWidth = MAX_DIMENSION;
      safeHeight = Math.max(1, Math.round(safeWidth / lockedRatioValue()));
    }
    return { width: safeWidth, height: safeHeight };
  }

  function fitDimensionsWithinLimit(width, height) {
    const safeWidth = Math.max(1, Number(width) || 1);
    const safeHeight = Math.max(1, Number(height) || 1);
    const scale = Math.min(1, MAX_DIMENSION / safeWidth, MAX_DIMENSION / safeHeight);
    return {
      width: Math.max(1, Math.round(safeWidth * scale)),
      height: Math.max(1, Math.round(safeHeight * scale))
    };
  }

  function updatePresetState() {
    document.querySelectorAll('.btn-ratio[data-ratio]').forEach((button) => {
      if (button.dataset.ratio === 'free') {
        button.classList.toggle('active', !state.lockAspect);
        button.setAttribute('aria-pressed', String(!state.lockAspect));
        return;
      }
      const [ratioWidth, ratioHeight] = button.dataset.ratio.split(':').map(Number);
      button.classList.toggle(
        'active',
        state.lockAspect && state.ratioWidth === ratioWidth && state.ratioHeight === ratioHeight
      );
      button.setAttribute('aria-pressed', String(button.classList.contains('active')));
    });

    document.querySelectorAll('.btn-size-preset[data-w][data-h]').forEach((button) => {
      const matchesSize =
        Number(button.dataset.w) === state.targetWidth &&
        Number(button.dataset.h) === state.targetHeight;
      button.classList.toggle('active', matchesSize);
      button.setAttribute('aria-pressed', String(matchesSize));
    });

    if (dom.aspectRatioCurrent) {
      dom.aspectRatioCurrent.textContent = state.lockAspect
        ? `${state.ratioWidth}:${state.ratioHeight}`
        : '自由';
    }
  }

  function updateQualityVisibility() {
    dom.qualityGroup.style.display = dom.format.value === 'image/png' ? 'none' : 'flex';
  }

  function updateGallerySummary() {
    dom.imageCount.textContent = state.images.length;
    dom.totalSize.textContent = formatBytes(state.images.reduce((sum, item) => sum + item.size, 0));
  }

  function updateUI() {
    const hasImages = state.images.length > 0;
    if (dom.presetOriginal) dom.presetOriginal.disabled = !hasImages;
    if (dom.smartCropAll) dom.smartCropAll.disabled = !hasImages || state.processing;
    dom.dropZone.style.display = hasImages ? 'none' : 'flex';
    dom.gallery.style.display = hasImages ? 'flex' : 'none';
    if (dom.bottomProcessArea) dom.bottomProcessArea.hidden = !hasImages;
    dom.download.disabled = !hasImages || state.processing;
    dom.addMore.disabled = !hasImages || state.processing;
    dom.clear.disabled = !hasImages || state.processing;
    updateGallerySummary();
    updateDatasetSummary();
  }

  async function processAndDownload() {
    if (!state.images.length || state.processing) return;
    const saveMethod = getSaveMethod();

    if (saveMethod === 'zip' && typeof JSZip === 'undefined') {
      showToast('ZIPライブラリを読み込めませんでした', true);
      return;
    }

    state.processing = true;
    clearProcessedResults();
    updateUI();
    addRecentSize(state.targetWidth, state.targetHeight);
    saveSettings();

    const format = dom.format.value;
    const quality = Number(dom.quality.value) / 100;
    const extension = format === 'image/jpeg' ? 'jpg' : format === 'image/png' ? 'png' : 'webp';
    const pattern = dom.rename.value.trim();
    const canvas = document.createElement('canvas');
    canvas.width = state.targetWidth;
    canvas.height = state.targetHeight;
    const ctx = canvas.getContext('2d', { alpha: format !== 'image/jpeg' });
    const results = [];

    try {
      for (let index = 0; index < state.images.length; index += 1) {
        const item = state.images[index];
        showProgress(
          Math.round(index / state.images.length * (saveMethod === 'zip' ? 60 : 90)),
          `画像を処理中… ${index + 1}/${state.images.length}`
        );

        drawCroppedImage(item, canvas, ctx, format);
        const blob = await canvasToBlob(canvas, format, quality);
        if (!blob) throw new Error('画像の生成に失敗しました');

        const fileName = outputFileName(item.name, index, pattern, extension);
        results.push({
          blob,
          fileName,
          type: format,
          url: URL.createObjectURL(blob),
          caption: buildCaption(item, index, fileName)
        });
        await idle();
      }

      state.processedResults = results;

      if (saveMethod === 'zip') {
        const zip = new JSZip();
        const exportedAt = new Date();
        results.forEach((result) => {
          zip.file(result.fileName, result.blob, { date: exportedAt });
          if (dom.generateTxt?.checked) {
            zip.file(result.fileName.replace(/\.[^.]+$/, '.txt'), result.caption, { date: exportedAt });
          }
        });

        showProgress(65, 'ZIPファイルを作成中…');
        const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
          showProgress(
            65 + Math.round(metadata.percent * 0.35),
            `ZIP圧縮中… ${Math.round(metadata.percent)}%`
          );
        });

        triggerDownload(
          zipBlob,
          `${sanitizeFileName(dom.zipName.value.trim() || 'swiftcrop_images')}.zip`
        );
        dom.mobileSaveSummary.hidden = true;
      } else {
        showProgress(100, '画像の準備が完了しました');
        renderProcessedImages();
        dom.mobileSaveSummary.hidden = false;
      }

      dom.completeCount.textContent = `${state.images.length}枚`;
      if (dom.completeTitle) dom.completeTitle.textContent = saveMethod === 'zip' ? 'ZIPをダウンロードしました' : '保存の準備ができました';
      if (dom.completeDetail) dom.completeDetail.textContent = saveMethod === 'zip'
        ? 'の画像をZIPにまとめました。'
        : 'の画像を、下のボタンから保存できます。';
      if (dom.completeImageCount) dom.completeImageCount.textContent = String(state.images.length);
      if (dom.completeCaptionCount) dom.completeCaptionCount.textContent = dom.generateTxt?.checked ? String(state.images.length) : '0';
      if (dom.completeZipName) dom.completeZipName.textContent = `${sanitizeFileName(dom.zipName.value.trim() || getDatasetZipBase())}.zip`;
      setTimeout(openModal, 350);
    } catch (error) {
      console.error(error);
      showToast('画像の保存準備中にエラーが発生しました', true);
      clearProcessedResults();
    } finally {
      state.processing = false;
      updateUI();
      hideProgressSoon(1500);
    }
  }

  function renderProcessedImages() {
    dom.processedImageList.innerHTML = '';

    const files = state.processedResults.map((result) =>
      createExportFile(result.blob, result.fileName, result.type)
    );
    const canShareAll = navigator.share &&
      navigator.canShare &&
      navigator.canShare({ files });

    dom.shareAll.hidden = !canShareAll;
    dom.saveHelp.textContent = canShareAll
      ? '「まとめて共有・保存」から端末の共有メニューを開けます。個別保存も可能です。'
      : '各画像の保存ボタンをタップしてください。iPhoneでは共有メニューから「画像を保存」を選べます。';

    state.processedResults.forEach((result, index) => {
      const row = document.createElement('article');
      row.className = 'processed-image-item';

      const preview = document.createElement('img');
      preview.src = result.url;
      preview.alt = result.fileName;

      const details = document.createElement('div');
      details.className = 'processed-image-details';

      const name = document.createElement('strong');
      name.textContent = result.fileName;

      const meta = document.createElement('span');
      meta.textContent = `${state.targetWidth} × ${state.targetHeight}px・${formatBytes(result.blob.size)}`;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-secondary btn-save-image';
      button.innerHTML = '<i class="fa-solid fa-download"></i> 保存';
      button.addEventListener('click', () => saveProcessedImage(index));

      details.append(name, meta, button);
      row.append(preview, details);
      dom.processedImageList.append(row);
    });
  }

  async function saveProcessedImage(index) {
    const result = state.processedResults[index];
    if (!result) return;

    const file = createExportFile(result.blob, result.fileName, result.type);
    const canShare = navigator.share &&
      navigator.canShare &&
      navigator.canShare({ files: [file] });

    if (canShare && isMobileDevice()) {
      try {
        await navigator.share({
          files: [file],
          title: result.fileName
        });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
        console.warn('Share failed, falling back to download', error);
      }
    }

    triggerDownload(result.blob, result.fileName);
  }

  async function shareAllProcessedImages() {
    if (!state.processedResults.length) return;

    const files = state.processedResults.map((result) =>
      createExportFile(result.blob, result.fileName, result.type)
    );

    if (!navigator.share || !navigator.canShare?.({ files })) {
      showToast('この端末ではまとめて共有できません', true);
      return;
    }

    try {
      await navigator.share({
        files,
        title: 'SwiftCropで処理した画像'
      });
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.error(error);
        showToast('共有メニューを開けませんでした', true);
      }
    }
  }

  function triggerDownload(blob, fileName) {
    const file = createExportFile(blob, fileName, blob.type);
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.append(anchor);
    anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function createExportFile(blob, fileName, type = blob.type || 'application/octet-stream') {
    return new File([blob], fileName, { type });
  }

  function clearProcessedResults() {
    state.processedResults.forEach((result) => {
      if (result.url) URL.revokeObjectURL(result.url);
    });
    state.processedResults = [];
    if (dom.processedImageList) dom.processedImageList.innerHTML = '';
    if (dom.mobileSaveSummary) dom.mobileSaveSummary.hidden = true;
  }

  function getSaveMethod() {
    return dom.saveIndividual.checked ? 'individual' : 'zip';
  }

  function initializeSaveMethod() {
    const saved = (() => {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').saveMethod;
      } catch {
        return null;
      }
    })();

    const defaultMethod = 'zip';
    const method = saved === 'individual' || saved === 'zip' ? saved : defaultMethod;

    dom.saveIndividual.checked = method === 'individual';
    dom.saveZip.checked = method === 'zip';
    dom.deviceRecommendation.textContent = isMobileDevice() ? 'スマートフォンでは「1枚ずつ保存・共有」がおすすめです。' : '複数画像は「ZIPでまとめて保存」すると便利です。';
    updateSaveMethodUI();
  }

  function updateSaveMethodUI() {
    const individual = getSaveMethod() === 'individual';
    if (dom.zipNameGroup) dom.zipNameGroup.hidden = individual;
    updateDownloadButton();
  }

  function updateDownloadButton() {
    const individual = getSaveMethod() === 'individual';
    const aiEnabled = dom.enableAiOptions?.checked === true;
    if (individual) {
      dom.download.innerHTML = '<i class="fa-solid fa-images"></i><span>画像を保存</span>';
    } else if (aiEnabled) {
      dom.download.innerHTML = '<i class="fa-solid fa-box-archive"></i><span>Dataset ZIPを作成</span>';
    } else {
      dom.download.innerHTML = '<i class="fa-solid fa-box-archive"></i><span>まとめてZIP保存</span>';
    }
  }

  function isMobileDevice() {
    return window.matchMedia('(pointer: coarse)').matches ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function drawCroppedImage(item, canvas, ctx, format) {
    const image = item.img;
    const targetAspect = state.targetWidth / state.targetHeight;
    const imageAspect = image.naturalWidth / image.naturalHeight;

    let baseWidth;
    let baseHeight;
    if (imageAspect > targetAspect) {
      baseHeight = image.naturalHeight;
      baseWidth = baseHeight * targetAspect;
    } else {
      baseWidth = image.naturalWidth;
      baseHeight = baseWidth / targetAspect;
    }

    const cropWidth = baseWidth / item.zoom;
    const cropHeight = baseHeight / item.zoom;
    const left = Math.max(0, image.naturalWidth - cropWidth) * item.cropX / 100;
    const top = Math.max(0, image.naturalHeight - cropHeight) * item.cropY / 100;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (format === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, left, top, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  }

  function outputFileName(original, index, pattern, extension) {
    const base = original.replace(/\.[^.]+$/, '');
    if (!pattern) return `${sanitizeFileName(base)}.${extension}`;

    const hashes = pattern.match(/#+/);
    if (hashes) {
      const number = String(index + 1).padStart(hashes[0].length, '0');
      return `${sanitizeFileName(pattern.replace(hashes[0], number))}.${extension}`;
    }
    return `${sanitizeFileName(pattern)}_${index + 1}.${extension}`;
  }

  function saveSettings() {
    const payload = {
      width: state.targetWidth,
      height: state.targetHeight,
      lockAspect: state.lockAspect,
      ratioWidth: state.ratioWidth,
      ratioHeight: state.ratioHeight,
      format: dom.format.value,
      quality: dom.quality.value,
      rename: dom.rename.value,
      zipName: dom.zipName.value,
      saveMethod: getSaveMethod(),
      datasetName: dom.datasetName?.value || '',
      triggerWord: dom.triggerWord?.value || '',
      captionTemplate: dom.captionTemplate?.value || '{{dataset}}',
      generateTxt: dom.generateTxt?.checked === true,
      enableAiOptions: dom.enableAiOptions?.checked === true
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    localStorage.setItem(FORMAT_KEY, dom.format.value);
  }

  function restoreSettings() {
    try {
      const settings = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      state.targetWidth = clampDimension(settings.width) || 1024;
      state.targetHeight = clampDimension(settings.height) || 1024;
      state.lockAspect = settings.lockAspect !== false;
      const savedRatioWidth = Number(settings.ratioWidth);
      const savedRatioHeight = Number(settings.ratioHeight);
      if (Number.isFinite(savedRatioWidth) && savedRatioWidth > 0 && Number.isFinite(savedRatioHeight) && savedRatioHeight > 0) {
        setLockedRatio(savedRatioWidth, savedRatioHeight);
      } else {
        setLockedRatio(state.targetWidth, state.targetHeight);
      }
      const savedFormat = localStorage.getItem(FORMAT_KEY);
      dom.format.value = SUPPORTED_TYPES.has(savedFormat) ? savedFormat : 'image/jpeg';
      if (settings.quality) dom.quality.value = clamp(Number(settings.quality), 10, 100);
      if (typeof settings.rename === 'string') dom.rename.value = settings.rename;
      if (typeof settings.zipName === 'string') dom.zipName.value = settings.zipName;
      if (dom.datasetName && typeof settings.datasetName === 'string') dom.datasetName.value = settings.datasetName;
      if (dom.triggerWord && typeof settings.triggerWord === 'string') dom.triggerWord.value = settings.triggerWord;
      if (dom.captionTemplate && typeof settings.captionTemplate === 'string') dom.captionTemplate.value = settings.captionTemplate || '{{dataset}}';
      // AI学習用オプションの開閉状態は復元しない。通常の日本語ページでは毎回OFFで開始する。
    } catch (error) {
      console.warn('設定を復元できませんでした', error);
    }
  }

  function addRecentSize(width, height) {
    const key = `${width}x${height}`;
    const items = getRecentSizes().filter((item) => `${item.w}x${item.h}` !== key);
    items.unshift({ w: width, h: height });
    localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, MAX_RECENT)));
    renderRecentSizes();
  }

  function getRecentSizes() {
    try {
      const items = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  }

  function renderRecentSizes() {
    const items = getRecentSizes();
    dom.recentSection.hidden = items.length === 0;
    dom.recentSizes.innerHTML = '';
    items.forEach(({ w, h }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'recent-size';
      button.textContent = `${w} × ${h}`;
      button.addEventListener('click', () => {
        if (state.lockAspect) setLockedRatio(w, h);
        setSize(w, h, true);
      });
      dom.recentSizes.append(button);
    });
  }

  function showProgress(percent, text) {
    dom.progress.style.display = 'flex';
    dom.progressBar.style.width = `${percent}%`;
    dom.progressBar.textContent = `${percent}%`;
    dom.progressStatus.textContent = text;
  }

  function hideProgressSoon(delay = 1000) {
    setTimeout(() => {
      if (!state.processing) dom.progress.style.display = 'none';
    }, delay);
  }

  function openModal() {
    dom.modal.hidden = false;
    document.body.classList.add('modal-open');
    dom.modalClose.focus();
  }

  function closeModal() {
    dom.modal.hidden = true;
    document.body.classList.remove('modal-open');
    dom.bookmarkHelp.hidden = true;
  }

  function showToast(message, error = false) {
    dom.toast.textContent = message;
    dom.toast.classList.toggle('is-error', error);
    dom.toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => dom.toast.classList.remove('show'), 2600);
  }

  function bindAdStatusWatcher() {
    document.querySelectorAll('.adsbygoogle').forEach((ad) => {
      const hideIfUnfilled = () => {
        if (ad.dataset.adStatus === 'unfilled') {
          ad.closest('.ad-slot')?.classList.add('ad-unfilled');
        }
      };
      new MutationObserver(hideIfUnfilled).observe(ad, {
        attributes: true,
        attributeFilter: ['data-ad-status']
      });
      hideIfUnfilled();
    });
  }

  function bindPwaInstall() {
    // Maruti Lab embeds the tool in a page of its own, so the install button
    // that used to sit in SwiftCrop's header is not here to bind to.
    if (!dom.install) return;
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      state.installPrompt = event;
      dom.install.hidden = false;
    });

    dom.install.addEventListener('click', async () => {
      if (!state.installPrompt) return;
      state.installPrompt.prompt();
      await state.installPrompt.userChoice;
      state.installPrompt = null;
      dom.install.hidden = true;
    });

    window.addEventListener('appinstalled', () => {
      dom.install.hidden = true;
      showToast('SwiftCropをホーム画面に追加しました');
    });
  }

  function registerServiceWorker() {
      }

  function clampDimension(value) {
    const number = Number.parseInt(value, 10);
    return Number.isFinite(number) && number > 0 ? clamp(number, 1, MAX_DIMENSION) : 0;
  }

  function sanitizeFileName(value) {
    return value.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').replace(/^_+|_+$/g, '') || 'swiftcrop';
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[char]);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function idle() {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  function isTypingTarget(target) {
    return target instanceof HTMLElement &&
      (target.matches('input, textarea, select') || target.isContentEditable);
  }

  window.addEventListener('resize', () => {
    if (state.images.length) updateGalleryLayout();
  });
})();
