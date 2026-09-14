import type { Metadata } from "next";
import { NoteIndex } from "./NoteIndex";

export const metadata: Metadata = {
  title: "LabNote",
  description:
    "Maruti Labの制作記。ブラウザだけで動く道具をどう作っているか、何を選んで、どこで苦労したかを書いています。",
  alternates: { canonical: "https://marutilab.com/blog" },
};

export default function BlogIndex() {
  return <NoteIndex page={1} />;
}
