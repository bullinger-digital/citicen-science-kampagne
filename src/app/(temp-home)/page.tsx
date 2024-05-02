import Image from "next/image";
import Logo from "../../../public/bullinger-digital.svg";

export default function Home() {
  return (
    <main className="p-10 bg-white shadow-lg max-w-screen-md mx-auto">
      <Image
        src={Logo}
        width="270"
        className="mb-7"
        alt="Bullinger Digital Logo"
      />
      <h3 className="mb-4 font-light text-2xl">
        Mithelfen bei Bullinger Digital
      </h3>
      <p className="mb-2">
        <strong>Willkommen</strong> bei der Citizen Science Kampagne zur
        Kontrolle und Korrektur der Namen in der Bullinger Briefsammlung!
      </p>
      <p className="mb-2">
        Die Korrekturkampagne startet am <strong>1. Juni 2024</strong>. Zum
        Auftakt findet ein{" "}
        <a
          href="https://www.zb.uzh.ch/de/events/bullinger-briefwechsel-zuerichs-erbe-erschliessen"
          target="_blank"
          className="text-blue-500 underline"
        >
          Workshop in der ZB
        </a>{" "}
        statt, gleichzeitig wird das Mitmach-Tool an dieser Stelle
        freigeschaltet. Damit können Sie sich jederzeit übers Internet an der
        Kampagne beteiligen.
      </p>
      <h3 className="font-light mt-4 mb-2 text-xl">Worum es geht</h3>
      <p className="mb-2">
        Heinrich Bullinger (1504–1575) war Nachfolger von Huldrych Zwingli in
        Zürich und eine Schlüsselfigur der Reformationszeit. 12&apos;000 Briefe
        von und an Bullinger sind erhalten, in den letzten drei Jahren hat das
        Projekt Bullinger Digital den umfangreichen Briefwechsel digital
        aufbereitet und auf{" "}
        <a
          href="https://www.bullinger-digital.ch"
          target="_blank"
          className="text-blue-500 underline"
        >
          www.bullinger-digital.ch
        </a>{" "}
        öffentlich zugänglich gemacht.
      </p>
      <p className="mb-2">
        Unter anderem haben wir mit Hilfe maschineller Verfahren tausende
        Personen- und Ortsnamen in den Brieftexten markiert und mit externen
        Wissensressourcen wie Wikipedia verlinkt. Diese Identifikation von
        Personen und Orten eröffnet neue Forschungszugänge und Einsichten, dafür
        müssen die Markierungen aber von guter Qualität sein.
      </p>
      <p className="mb-2">
        In den vorwiegend in Latein und auch in Frühneuhochdeutsch verfassten
        Briefen gibt es eine Vielzahl Möglichkeiten, wie ein Name geschrieben
        sein kann. Nicht nur die Schreibweise variiert, auch können verschiedene
        lateinische und deutsche Bezeichnungen für denselben Ort oder dieselbe
        Person vorkommen. Schliesslich kann der Eintrag in den heutigen
        Wissensressourcen nochmals leicht anders lauten.
      </p>
      <h3 className="font-light mt-4 mb-2 text-xl">Was Sie tun können</h3>
      <p className="mb-2">
        Für die Korrektur und die Verlinkung sind wir auf Ihre Unterstützung
        angewiesen: Wir brauchen den kritischen Blick von Freiwilligen, die
        kontrollieren
      </p>
      <ul className="mb-2 list-disc ml-7">
        <li>
          ob alle Personen- und Ortsnamen markiert sind, die in einem Brief
          vorkommen;
        </li>
        <li>
          ob die markierten Varianten von Personen- und Ortsnamen dem korrekten
          Grundeintrag zugewiesen sind;
        </li>
        <li>
          ob die angegebenen Verlinkungen zu externen Wissensressourcen korrekt
          sind;
        </li>
        <li>
          bzw. ob sich Einträge zu den markierten Personen in externen
          Wissensressourcen finden.
        </li>
      </ul>
      <p className="mb-2">
        Wir freuen uns, wenn sie am 1. Juni 2024 auf diese Website zurückkehren
        und unser Projekt durch Ihre Mitarbeit voranbringen. Vielen Dank!
      </p>
    </main>
  );
}
