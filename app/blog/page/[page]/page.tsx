import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { NoteIndex } from "../../NoteIndex";
import { pageCount, pagePath } from "../../posts";

type Props = { params: Promise<{ page: string }> };

// Page one is /blog, so /blog/page/1 is not a URL the site produces. It is
// still guessable, and the page it means does exist, so it is moved to the
// real one rather than denied. Anything past the last page means nothing, and
// says so with a 404.
const parse = (value: string) => {
  const page = Number(value);
  return Number.isInteger(page) && page >= 2 && page <= pageCount ? page : null;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = parse((await params).page);
  if (!page) return { title: "LabNote" };
  return {
    title: `LabNote（${page}ページ目）`,
    description:
      "Maruti Labの制作記。ブラウザだけで動く道具をどう作っているか、何を選んで、どこで苦労したかを書いています。",
    alternates: { canonical: `https://marutilab.com${pagePath(page)}` },
  };
}

export default async function BlogIndexPage({ params }: Props) {
  const { page: raw } = await params;
  if (raw === "1") permanentRedirect("/blog");
  const page = parse(raw);
  if (!page) notFound();
  return <NoteIndex page={page} />;
}
