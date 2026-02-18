"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "~/components/ui/dialog";
import { PlayIcon } from "@heroicons/react/24/solid";
import Image from "next/image";

const WISTIA_MEDIA_ID = "y91kv0qmzm";
const ASPECT_PERCENT = 71.24;
// High-res first frame from Wistia oEmbed (swatch is intentionally blurred)
const THUMBNAIL_URL =
  "https://embed-ssl.wistia.com/deliveries/ebfb3edf361a39d7a4fec06abbc9356da0018835.jpg?image_crop_resized=960x682";
export function VideoDemoDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative w-full overflow-hidden rounded-lg bg-black focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        style={{ paddingTop: `${ASPECT_PERCENT}%` }}
      >
        <Image
          width={1000}
          height={1000}
          src={THUMBNAIL_URL}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          />
        <span className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover:bg-black/40">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-black shadow-lg transition-transform group-hover:scale-110 group-hover:bg-white">
            <PlayIcon className="ml-1 h-7 w-7" />
          </span>
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="gap-0 overflow-hidden rounded-2xl p-0 flex center bg-background min-w-9/10"
          showCloseButton
        >
          <div className="relative w-full bg-transparent" style={{ paddingTop: "71%" }}>
            <iframe
              title="Gitfix demo video"
              src={`https://fast.wistia.com/embed/iframe/${WISTIA_MEDIA_ID}?videoFoam=true&controlsVisibleOnLoad=true`}
              className="absolute inset-0 h-full w-full bg-transparent"
              allowFullScreen

            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
