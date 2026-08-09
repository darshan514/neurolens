import { useState } from "react";
import { MapPin, PhoneCall, Stethoscope, Video } from "lucide-react";
import { Badge, Card, DisclaimerBanner, PageHeading } from "../components/ui";
import { MotionPage } from "../components/Layout";

interface Provider {
  name: string;
  type: "Neurologist" | "Hospital" | "Movement Disorder Clinic";
  address: string;
  distance: string;
  telemedicine: boolean;
  phone: string;
}

const PROVIDERS: Provider[] = [
  { name: "Apollo Movement Disorder Clinic", type: "Movement Disorder Clinic", address: "Greams Road, Chennai", distance: "2.4 km", telemedicine: true, phone: "+91 44 2829 0909" },
  { name: "Dr. Anitha Raman — Neurologist", type: "Neurologist", address: "T. Nagar, Chennai", distance: "4.1 km", telemedicine: true, phone: "+91 44 2434 2277" },
  { name: "Government Rajiv Gandhi General Hospital", type: "Hospital", address: "Park Town, Chennai", distance: "6.8 km", telemedicine: false, phone: "+91 44 2530 5000" },
  { name: "Sri Ramachandra Institute of Neurology", type: "Movement Disorder Clinic", address: "Porur, Chennai", distance: "9.3 km", telemedicine: true, phone: "+91 44 4592 8500" },
];

export default function FindCare() {
  const [query, setQuery] = useState("Chennai, India");
  const [filterTele, setFilterTele] = useState(false);
  const list = PROVIDERS.filter((p) => (filterTele ? p.telemedicine : true));
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent("neurologist " + query)}&z=12&output=embed`;

  return (
    <MotionPage>
      <PageHeading
        title="Find a neurologist"
        subtitle="Locate neurologists, hospitals and movement-disorder clinics near you — including telemedicine options."
        action={
          <Badge tone="teal">
            <Video size={12} /> Telemedicine supported
          </Badge>
        }
      />

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-white/8 p-4">
          <div className="relative flex-1">
            <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-ink-900/80 py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-brand-400/60"
              placeholder="City or area"
            />
          </div>
          <button
            onClick={() => setFilterTele((v) => !v)}
            className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
              filterTele ? "border-teal-400/50 bg-teal-500/15 text-teal-200" : "border-white/10 text-white/55 hover:border-white/25"
            }`}
          >
            <Video size={14} className="mr-1.5 inline" />
            Telemedicine only
          </button>
        </div>
        <div className="grid gap-0 lg:grid-cols-2">
          <div className="space-y-2 p-4">
            {list.map((p) => (
              <div key={p.name} className="rounded-xl border border-white/8 bg-ink-900/50 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium text-white/90">
                      <Stethoscope size={14} className="text-brand-300" /> {p.name}
                    </p>
                    <p className="mt-1 text-xs text-white/45">
                      {p.type} · {p.address} · {p.distance}
                    </p>
                  </div>
                  {p.telemedicine && (
                    <Badge tone="teal">
                      <Video size={11} /> Tele
                    </Badge>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button className="rounded-lg bg-brand-500/15 px-3 py-1.5 text-xs font-medium text-brand-200 hover:bg-brand-500/25">
                    <PhoneCall size={12} className="mr-1 inline" /> {p.phone}
                  </button>
                  {p.telemedicine && (
                    <button className="rounded-lg border border-teal-400/25 px-3 py-1.5 text-xs font-medium text-teal-200 hover:bg-teal-500/10">
                      Book video consult
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="min-h-[320px] border-t border-white/8 lg:border-l lg:border-t-0">
            <iframe
              title="Map of nearby neurologists"
              src={mapSrc}
              className="h-full min-h-[320px] w-full grayscale-[0.3]"
              loading="lazy"
            />
          </div>
        </div>
      </Card>

      <div className="mt-6">
        <DisclaimerBanner />
      </div>
    </MotionPage>
  );
}
