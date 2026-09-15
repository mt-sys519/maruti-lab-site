export const siteCopy={
 ja:{studio:"制作画面",about:"YURAMEKIについて",gallery:"作例",faq:"よくある質問",contact:"お問い合わせ"},
 en:{studio:"Studio",about:"About YURAMEKI",gallery:"Motion Studies",faq:"FAQ",contact:"Contact"},
} as const;

export type SiteLocale=keyof typeof siteCopy;
export const defaultLocale:SiteLocale="ja";
