import { useServices } from "@/lib/services";
import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Star, Footprints, Activity, HeartPulse, Accessibility, Stethoscope, ShieldCheck, Check, MapPin, Phone, Clock, Menu } from "lucide-react";
import hero from "@/assets/hero.jpg";
import s1 from "@/assets/strip-1.jpg";
import s2 from "@/assets/strip-2.jpg";
import s3 from "@/assets/strip-3.jpg";
import s4 from "@/assets/strip-4.jpg";
import doctor from "@/assets/doctor.jpg";
import about2 from "@/assets/about-2.jpg";
import teamPhysio from "@/assets/team-physio.jpg";
import teamTechnician from "@/assets/team-technician.jpg";
import { BrandLogo } from "@/components/BrandLogo";
import { BRAND_NAME } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${BRAND_NAME} | Rehabilitation and Physiotherapy in Kigali` },
      { name: "description", content: "Prosthetics, orthotics, physiotherapy and outpatient rehabilitation in Kigali. Book your appointment online." },
      { property: "og:title", content: BRAND_NAME },
      { property: "og:description", content: "Personalized prosthetic, orthotic and physiotherapy care. Book online." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const PHONE = "+250 788 000 000";

function SectionLabel({ n, label, dark }: { n: string; label: string; dark?: boolean }) {
  return (
    <div className={`flex items-center gap-4 text-[10px] uppercase tracking-[0.2em] ${dark ? "text-navy-foreground/50" : "text-foreground/50"}`}>
      <span>[{n}]</span>
      <span className={`h-px flex-1 ${dark ? "bg-navy-foreground/20" : "bg-foreground/20"}`} />
      <span>{label}</span>
    </div>
  );
}

function Nav() {
  const links = ["Home", "About", "Services", "Check-in", "Contact"];
  const [open, setOpen] = useState(false);
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="border-b border-navy-foreground/10 bg-navy/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 text-navy-foreground sm:px-6 sm:py-4">
          <a href="/" className="min-w-0 shrink-0 leading-none">
            <BrandLogo onNavy className="h-auto w-24 sm:w-[126px]" />
          </a>
          <nav className="hidden items-center gap-1 text-sm lg:flex">
            {links.map((l, i) => (
              <a key={l} href={`#${l.toLowerCase().replace(" ", "-")}`} className={`rounded-full px-4 py-1.5 transition ${i === 0 ? "bg-navy-soft" : "hover:bg-navy-foreground/10"}`}>{l}</a>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link to="/provider" className="hidden items-center gap-2 rounded-full border border-navy-foreground/40 px-5 py-2 text-sm transition hover:bg-navy-foreground/10 sm:inline-flex">Provider</Link>
            <a href="/book" className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-brand-hover sm:px-5">Book Now <ArrowRight className="h-4 w-4" /></a>
            <button type="button" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-navy-foreground/10 lg:hidden">
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
        {open && (
          <nav className="border-t border-navy-foreground/10 px-4 pb-4 pt-2 text-navy-foreground lg:hidden">
            {links.map((l) => (
              <a key={l} onClick={() => setOpen(false)} href={`#${l.toLowerCase().replace(" ", "-")}`} className="block rounded-xl px-3 py-3 text-base hover:bg-navy-foreground/10">{l}</a>
            ))}
            <Link to="/provider" className="mt-2 block rounded-xl border border-navy-foreground/30 px-3 py-3 text-center text-base">Provider sign in</Link>
          </nav>
        )}
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative min-h-[720px] overflow-hidden bg-navy text-navy-foreground">
      <img src={hero} alt="Physiotherapist helping a patient walk with a prosthetic leg" width={1600} height={1008} className="absolute inset-0 h-full w-full object-cover opacity-60 mix-blend-luminosity" />
      <div className="absolute inset-0 bg-gradient-to-r from-navy/85 via-navy/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-navy to-transparent" />
      <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-32 sm:pt-40">
        <span className="inline-block rounded-full border border-navy-foreground/30 px-4 py-1 text-xs">Rehabilitation care in Kigali</span>
        <h1 className="mt-6 max-w-2xl text-[2.6rem] font-medium leading-[1.2] tracking-tight sm:text-5xl md:text-[5rem]">
          Smart care for everyday health.
        </h1>
        <p className="mt-6 max-w-md text-base text-navy-foreground/85">Personalized physiotherapy, prosthetics, orthotics and rehabilitation to help you move better and recover well.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a id="book" href="/book" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:bg-brand-hover">Book Appointment <ArrowRight className="h-4 w-4" /></a>
          <a href="#check-in" className="rounded-full border border-navy-foreground/40 px-6 py-3 text-sm backdrop-blur">Online Check-in</a>
        </div>
      </div>
    </section>
  );
}

function Strip() {
  const ref = useRef<HTMLElement>(null);
  const [p, setP] = useState(0.5);

  useEffect(() => {
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const t = (vh - rect.top) / (vh + rect.height);
      setP(Math.min(1, Math.max(0, t)));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const imgs = [
    [s1, "Orthotist fitting a knee brace"],
    [s2, "Prosthetist adjusting a prosthetic leg"],
    [s3, "Shoulder rehabilitation with resistance band"],
    [s4, "Manual therapy on a patient's knee"],
  ] as const;
  const rowA = [...imgs, ...imgs];
  const rowB = [...[...imgs].reverse(), ...[...imgs].reverse()];
  const drift = (p - 0.5) * 10;

  return (
    <section ref={ref} className="overflow-hidden bg-navy py-24">
      <div className="space-y-3 opacity-90" style={{ opacity: Math.min(0.95, 0.35 + p * 1.6) }}>
        <div className="flex w-[130%] gap-3 will-change-transform" style={{ marginLeft: "-15%", transform: `translateX(${drift}%)` }}>
          {rowA.map(([src, alt], i) => (
            <img key={`a-${i}`} src={src} alt={i < imgs.length ? alt : ""} loading="lazy" width={976} height={688} className="aspect-[3/2] w-1/4 rounded-lg object-cover" />
          ))}
        </div>
        <div className="flex w-[130%] gap-3 will-change-transform" style={{ marginLeft: "-15%", transform: `translateX(${-drift}%)` }}>
          {rowB.map(([src, alt], i) => (
            <img key={`b-${i}`} src={src} alt={i < imgs.length ? alt : ""} loading="lazy" width={976} height={688} className="aspect-[3/2] w-1/4 rounded-lg object-cover" />
          ))}
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="about" className="bg-navy pb-28 text-navy-foreground">
      <div className="mx-auto max-w-6xl px-6">
        <SectionLabel n="01" label="About us" dark />
        <div className="mt-12 grid gap-10 md:grid-cols-2">
          <h2 className="text-4xl font-light leading-tight md:text-5xl">Where Mobility Meets Complete Rehabilitation Care</h2>
          <div className="space-y-4 text-sm leading-relaxed text-navy-foreground/80">
            <p>At {BRAND_NAME}, we help you take practical steps toward recovery. Whether you need a new prosthesis, a custom brace, or a structured physiotherapy plan, our team makes each step clear and tailored to you.</p>
            <p>We bring prosthetic and orthotic fabrication, physiotherapy and outpatient therapy together — so you get coordinated care without visiting multiple clinics.</p>
            <p>From your first assessment to your final fitting, everything we do is centred on helping you move with confidence.</p>
          </div>
        </div>
        <div className="mt-14 grid gap-3 md:grid-cols-2">
          <img src={s2} alt="Prosthetic workshop" loading="lazy" width={976} height={688} className="aspect-[16/10] w-full rounded-lg object-cover" />
          <img src={about2} alt="Reception team welcoming a patient on crutches" loading="lazy" width={1024} height={656} className="aspect-[16/10] w-full rounded-lg object-cover" />
        </div>
      </div>
    </section>
  );
}

function Specialist() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const team = [
    { name: "Dr. K. Mensah", role: "Orthopedic Rehabilitation Physician", img: doctor, bio: "Patients choose Dr. Mensah because he takes time to understand how an injury or limb difference affects daily life, explains every option, and builds a plan that fits real goals — walking, working, playing sport, or simply moving without pain." },
    { name: "Aline Uwase", role: "Physiotherapist", img: teamPhysio, bio: "Aline guides every session at your pace — blending hands-on therapy with clear, simple exercises so progress continues between visits. Patients describe her sessions as patient, encouraging and never rushed." },
    { name: "Jean-Paul Nkusi", role: "Orthopedic Technician", img: teamTechnician, bio: "Jean-Paul crafts and fine-tunes every prosthesis and brace in our on-site workshop. His precise measurements and careful adjustments make the difference between a device you wear and one you truly live in." },
  ];
  const [active, setActive] = useState(0);
  const person = team[active] ?? team[0]!;

  return (
    <section ref={sectionRef} className="overflow-hidden bg-background py-28">
      <div className="mx-auto max-w-6xl px-6">
        <SectionLabel n="03" label="Our team" />
        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <h2 className="text-4xl font-light leading-tight md:text-5xl">Meet the Team Behind Your Recovery</h2>
          <p className="self-end text-sm text-foreground/75 md:max-w-xs md:justify-self-end">Physicians, physiotherapists and technicians working side by side — so your assessment, therapy and fitting all fit together.</p>
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          {team.map((m, i) => (
            <button
              key={m.name}
              type="button"
              aria-pressed={i === active}
              onClick={() => setActive(i)}
              className={`rounded-full border px-5 py-2 text-sm transition ${i === active ? "border-navy bg-navy text-navy-foreground" : "border-foreground/30 text-foreground/70 hover:border-navy"}`}
            >
              {m.name}
            </button>
          ))}
        </div>
        <div className="mt-10 grid items-center gap-8 md:grid-cols-2">
          <div key={person.name} className={`rounded-xl bg-card p-8 md:mr-10 ${isVisible ? "specialist-copy-in" : "specialist-before-right"}`}>
            <p className="text-xs text-foreground/60">{person.name} — {person.role}</p>
            <p className="mt-5 text-sm leading-relaxed">{person.bio}</p>
          </div>
          <img key={`img-${person.name}`} src={person.img} alt={person.name} loading="lazy" width={1024} height={1024} className={`aspect-square w-full rounded-xl object-cover ${isVisible ? "specialist-photo-in" : "specialist-before-left"}`} />
        </div>
        <div className="mt-8 grid items-center gap-8 md:grid-cols-[1.4fr_1fr]">
          <div className={`relative overflow-hidden rounded-xl bg-navy-soft p-8 text-navy-foreground ${isVisible ? "specialist-photo-in specialist-delay" : "specialist-before-left"}`}>
            <img src={s3} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-20 mix-blend-luminosity" />
            <div className="relative">
              <p className="text-xs text-navy-foreground/70">Our focus:</p>
              <p className="mt-24 text-xl font-light leading-snug">Clear, honest communication<br />& Gentle, goal-driven therapy</p>
            </div>
          </div>
          <div className={`rounded-xl bg-card p-8 md:ml-10 ${isVisible ? "specialist-copy-in specialist-delay" : "specialist-before-right"}`}>
            <p className="text-[11px] text-foreground/60">High-Quality, Hands-On Rehabilitation</p>
            <p className="mt-4 text-lg font-light leading-snug">Personalized treatment planning & long-term patient relationships</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const quotes = [
    "“They fitted my new prosthetic leg with such patience. I was walking confidently within weeks.”",
    "“The physiotherapists are gentle and explain every exercise. My knee feels stronger than before.”",
    "“Booking and checking in was simple. Friendly staff, modern equipment and great results.”",
  ];
  return (
    <section className="bg-navy py-28 text-navy-foreground">
      <div className="mx-auto max-w-6xl px-6">
        <SectionLabel n="04" label="Testimonials" dark />
        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <h2 className="text-4xl font-light leading-tight md:text-5xl">What Patients Are Saying About Us</h2>
          <p className="self-end text-sm text-navy-foreground/80 md:max-w-xs md:justify-self-end">Hear what patients say about their care.</p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {quotes.map((q) => (
            <div key={q} className="flex flex-col justify-between gap-10 rounded-xl border border-navy-foreground/25 p-6">
              <div className="flex gap-1">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}</div>
              <p className="text-sm leading-relaxed text-navy-foreground/85">{q}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-sm">We're proud to build lasting relationships with patients who trust us with their mobility.</p>
      </div>
    </section>
  );
}

function Services() {
  const LOOK: Record<string, { icon: typeof Activity; img: string }> = {
    prosthetics: { icon: Footprints, img: s2 }, orthotics: { icon: ShieldCheck, img: s1 },
    physiotherapy: { icon: Activity, img: s3 }, outpatient: { icon: HeartPulse, img: s4 }, "gait-training": { icon: Accessibility, img: hero },
  };
  const items = useServices().filter((x) => x.show_on_home).map((x) => ({
    icon: LOOK[x.id]?.icon ?? Activity, img: x.image_url || LOOK[x.id]?.img || hero, t: x.name, d: x.description, detail: x.details || x.description,
  }));
  const [open, setOpen] = useState<string | null>(null);
  const selected = items.find((item) => item.t === open);
  return (
    <section id="services" className="bg-navy pb-28 text-navy-foreground">
      <div className="mx-auto max-w-7xl px-6">
        <SectionLabel n="02" label="Services we offer" dark />
        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <h2 className="text-4xl font-light leading-tight md:text-5xl">Care Designed Around Your Mobility Goals</h2>
          <p className="self-end text-sm text-navy-foreground/80 md:max-w-xs md:justify-self-end">A full range of rehabilitation services to improve your independence and quality of life. Tap any service to learn more and book.</p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        {items.map(({ icon: Icon, img, t, d }) => {
          const isOpen = open === t;
          return (
            <Button
              key={t}
              type="button"
              variant="ghost"
              aria-expanded={isOpen}
              aria-controls="service-detail"
              onClick={() => setOpen(isOpen ? null : t)}
              className={`group h-full min-h-[330px] w-full flex-col items-stretch justify-start overflow-hidden rounded-xl bg-card p-0 text-left text-foreground shadow-none transition-[box-shadow,transform] duration-300 hover:-translate-y-1 hover:bg-card hover:text-foreground ${isOpen ? "ring-2 ring-navy-soft shadow-lg" : ""}`}
            >
              <div className="block h-40 w-full overflow-hidden">
                <img src={img} alt={t} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
              </div>
              <div className="flex flex-1 flex-col whitespace-normal p-5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-background"><Icon className="h-4 w-4" /></span>
                  <span className="text-[10px] uppercase tracking-widest text-foreground/50">{isOpen ? "Selected" : "Details"}</span>
                </div>
                <h3 className="mt-4 font-medium">{t}</h3>
                <p className="mt-2 text-xs leading-relaxed text-foreground/60">{d}</p>
              </div>
            </Button>
          );
        })}
        </div>
        <div className={`grid transition-[grid-template-rows,margin] duration-300 ease-out ${selected ? "mt-6 grid-rows-[1fr]" : "mt-0 grid-rows-[0fr]"}`}>
          <div className="overflow-hidden">
            {selected && (
              <div id="service-detail" key={selected.t} className="service-detail-in rounded-xl border border-navy-foreground/15 bg-navy-foreground/5 p-6 md:p-8">
                <div className="grid items-center gap-6 md:grid-cols-[1fr_auto]">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-navy-foreground/50">Selected service</p>
                    <h3 className="mt-2 text-2xl font-medium">{selected.t}</h3>
                    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-navy-foreground/75">{selected.detail}</p>
                  </div>
                  <Button asChild className="h-11 rounded-full hover:bg-brand-hover">
                    <a href="/book">Book Appointment <ArrowRight className="h-4 w-4" /></a>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="mt-10 text-center">
          <Button asChild variant="secondary" className="h-11 rounded-full px-6 text-navy">
            <a href="/book">Book an Appointment <ArrowRight className="h-4 w-4" /></a>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Process() {
  const steps = [
    { n: "1", t: "Book your visit", d: "Choose a service and time online — it takes under two minutes." },
    { n: "2", t: "Check in on arrival", d: "Tap 'I've Arrived' and our front desk is notified instantly." },
    { n: "3", t: "Assessment & plan", d: "Your specialist examines you and builds a personal treatment plan." },
    { n: "4", t: "Treatment & follow-up", d: "Therapy, fitting or bracing begins, with reviews to track progress." },
  ];
  return (
    <section id="first-visit" className="bg-background py-28">
      <div className="mx-auto max-w-6xl px-6">
        <SectionLabel n="05" label="Your first visit" />
        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <h2 className="text-4xl font-light leading-tight md:text-5xl">Our Process, From Booking to Recovery</h2>
          <p className="self-end text-sm text-foreground/70 md:max-w-xs md:justify-self-end">Your first visit is simple. Here's exactly what happens, step by step.</p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="rounded-xl bg-card p-6">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-navy text-sm text-navy-foreground">{s.n}</span>
              <h3 className="mt-5 font-medium">{s.t}</h3>
              <p className="mt-2 text-xs leading-relaxed text-foreground/60">{s.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <a href="/book" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:bg-brand-hover">Book Appointment <ArrowRight className="h-4 w-4" /></a>
        </div>
      </div>
    </section>
  );
}

function AskQuestion() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", contact: "", question: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });
  return (
    <section id="ask" className="bg-background pb-28">
      <div className="mx-auto max-w-6xl px-6">
        <SectionLabel n="07" label="Ask a question" />
        <div className="mt-12 grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-4xl font-light leading-tight md:text-5xl">Have a Question? Ask Us Anything</h2>
            <p className="mt-4 max-w-sm text-sm text-foreground/70">Not sure which service you need, or want to know if we can help with your condition? Send us a question and our team will get back to you.</p>
          </div>
          {sent ? (
            <div className="flex flex-col items-start justify-center rounded-xl bg-card p-8">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-navy text-navy-foreground"><Check className="h-5 w-5" /></span>
              <h3 className="mt-4 text-xl font-light">Question received</h3>
              <p className="mt-2 text-sm text-foreground/70">Thank you, {form.name || "friend"}. Our team will reply to you shortly.</p>
              <button onClick={() => { setSent(false); setForm({ name: "", contact: "", question: "" }); }} className="mt-6 text-sm underline underline-offset-4">Ask another question</button>
            </div>
          ) : (
            <form className="rounded-xl bg-card p-8" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
              <label className="block text-xs text-foreground/60">Your name
                <input required maxLength={100} value={form.name} onChange={set("name")} className="mt-1 w-full rounded-md border border-foreground/20 bg-background px-3 py-2.5 text-sm outline-none focus:border-navy-soft" placeholder="Full name" />
              </label>
              <label className="mt-4 block text-xs text-foreground/60">Phone or email
                <input required maxLength={255} value={form.contact} onChange={set("contact")} className="mt-1 w-full rounded-md border border-foreground/20 bg-background px-3 py-2.5 text-sm outline-none focus:border-navy-soft" placeholder="How we can reach you" />
              </label>
              <label className="mt-4 block text-xs text-foreground/60">Your question
                <textarea required maxLength={1000} rows={4} value={form.question} onChange={set("question")} className="mt-1 w-full rounded-md border border-foreground/20 bg-background px-3 py-2.5 text-sm outline-none focus:border-navy-soft" placeholder="Type your question here…" />
              </label>
              <button type="submit" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:bg-brand-hover">Send Question <ArrowRight className="h-4 w-4" /></button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function PatientOptions() {
  return (
    <section id="patient-info" className="bg-background py-28">
      <div className="mx-auto max-w-6xl px-6">
        <SectionLabel n="06" label="Patient options" />
        <h2 className="mt-12 text-center text-4xl font-light md:text-5xl">A Simpler Way to Book, Check In and Recover</h2>
        <p className="mt-4 text-center text-sm text-foreground/70">Book online and let our front desk know you've arrived — no long waiting lines.</p>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <div id="check-in" className="rounded-xl bg-card p-8">
            <p className="text-[10px] uppercase tracking-widest text-foreground/60">+ Appointments</p>
            <h3 className="mt-4 text-2xl font-light">Book Online</h3>
            <p className="mt-2 text-xs text-foreground/60">Choose your service, specialist and time.</p>
            <ul className="mt-6 space-y-3 text-sm">
              {["Physiotherapy & outpatient sessions", "Prosthetic and orthotic assessments", "Follow-up and adjustment visits"].map((x) => <li key={x} className="flex gap-2"><Check className="h-4 w-4" />{x}</li>)}
            </ul>
            <a href="/book" className="mt-8 inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2.5 text-sm text-navy-foreground">Book Appointment <ArrowRight className="h-4 w-4" /></a>
          </div>
          <div className="rounded-xl bg-card p-8">
            <p className="text-[10px] uppercase tracking-widest text-foreground/60">+ Arrival</p>
            <h3 className="mt-4 text-2xl font-light">Online Check-in</h3>
            <p className="mt-2 text-xs text-foreground/60">Notify reception the moment you arrive.</p>
            <ul className="mt-6 space-y-3 text-sm">
              {["Instant alert to our check-in desk", "Insurance & referral details in advance", "Live updates on your queue position"].map((x) => <li key={x} className="flex gap-2"><Check className="h-4 w-4" />{x}</li>)}
            </ul>
            <a href="#" className="mt-8 inline-flex items-center gap-2 rounded-full border border-foreground/40 px-5 py-2.5 text-sm">I've Arrived <ArrowRight className="h-4 w-4" /></a>
          </div>
        </div>
      </div>
    </section>
  );
}

const CAT: Record<string, string> = { physiotherapy: "Physiotherapy", orthotics: "Orthotics & supports", prosthetics: "Prosthetics", pharmacy: "Pharmacy" };

function Products() {
  const list = useQuery(api.catalog.publicProducts) ?? [];
  if (!list.length) return null;
  return (
    <section id="products" className="bg-background py-28">
      <div className="mx-auto max-w-6xl px-6">
        <SectionLabel n="08" label="Products" />
        <h2 className="mt-12 text-center text-4xl font-light md:text-5xl">Supports, Aids &amp; Pharmacy</h2>
        <p className="mt-4 text-center text-sm text-foreground/70">Available at our clinic. Ask at reception — our team will help you choose the right one.</p>
        <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {list.map((p) => (
            <div key={p.id} className="flex flex-col overflow-hidden rounded-xl bg-card">
              {p.image_url ? <img src={p.image_url} alt={p.name} loading="lazy" className="aspect-square w-full object-cover" />
                : <div className="flex aspect-square items-center justify-center bg-secondary"><Activity className="h-8 w-8 text-foreground/30" /></div>}
              <div className="flex flex-1 flex-col p-4">
                <p className="text-[10px] uppercase tracking-widest text-foreground/50">{CAT[p.category] ?? p.category}</p>
                <h3 className="mt-1 text-sm font-medium">{p.name}</h3>
                {p.description && <p className="mt-1 line-clamp-2 text-xs text-foreground/60">{p.description}</p>}
                <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-sm">
                  <span className="font-medium">{new Intl.NumberFormat("en-US").format(p.price)} RWF</span>
                  <span className={p.in_stock ? "text-xs text-foreground/60" : "text-xs text-destructive"}>{p.in_stock ? "Available" : "Out of stock"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Location() {
  return (
    <section id="contact" className="bg-navy py-28 text-navy-foreground">
      <div className="mx-auto max-w-6xl px-6">
        <SectionLabel n="09" label="Location" dark />
        <div className="mt-12 grid items-center gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-4xl font-light leading-tight md:text-5xl">Conveniently Located in Kigali</h2>
            <div className="mt-8 space-y-4 text-sm text-navy-foreground/80">
              <p className="flex gap-3"><MapPin className="h-4 w-4 shrink-0" /> KG 7 Ave, Kacyiru, Kigali, Rwanda</p>
              <p className="flex gap-3"><Phone className="h-4 w-4 shrink-0" /> {PHONE}</p>
              <p className="flex gap-3"><Clock className="h-4 w-4 shrink-0" /> Mon – Fri 8:00–18:00 · Sat 9:00–13:00</p>
              <p className="flex gap-3"><Stethoscope className="h-4 w-4 shrink-0" /> Referrals from hospitals and clinics welcome</p>
            </div>
          </div>
          <iframe title="Map" className="h-80 w-full rounded-xl border-0" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=30.07%2C-1.96%2C30.11%2C-1.93&layer=mapnik" />
        </div>
      </div>
      <footer className="mx-auto mt-24 flex max-w-6xl flex-wrap justify-between gap-4 border-t border-navy-foreground/15 px-6 pt-8 text-xs text-navy-foreground/60">
        <span>© 2026 {BRAND_NAME}</span>
        <span>Prosthetics · Orthotics · Physiotherapy · Outpatient Therapy</span>
      </footer>
    </section>
  );
}

function Index() {
  return (
    <main className="font-sans">
      <Nav />
      <Hero />
      <Strip />
      <About />
      <Services />
      <Specialist />
      <Testimonials />
      <Process />
      <PatientOptions />
      <AskQuestion />
      <Products />
      <Location />
    </main>
  );
}
