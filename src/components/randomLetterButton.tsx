"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export const RandomLetterButton = () => {
  const [randomLetterId, setRandomLetterId] = useState<number | null>(null);

  const updateRandomLetterId = () => {
    setRandomLetterId(Math.floor(Math.random() * 13159) + 1);
  };
  useEffect(() => {
    updateRandomLetterId();
  }, []);

  return (
    <Link
      className="text-sm rounded-lg bg-blue-100 hover:bg-blue-200 p-2 inline-block"
      href={`/letter/${randomLetterId}`}
      onClick={() => updateRandomLetterId()}
    >
      Zufälligen Brief auswählen
    </Link>
  );
};
