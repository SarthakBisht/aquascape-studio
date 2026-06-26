"use client";

import { useState, type ReactNode } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { TANK_LIMITS } from "@/data/tankPresets";
import {
  SALTS,
  EI_TARGETS,
  REMIN_PRODUCTS,
  SUBSTRATE_DENSITY,
  LIGHT_BANDS,
  classifyBand,
} from "@/data/dosing";
import * as calc from "@/lib/aquacalc";

// Full-screen aquascaping calculator — a manual reference that pre-fills from the
// live tank/substrate and (for Volume & Substrate) can push results back into the
// scene. Shell mirrors Gallery.tsx; math lives in lib/aquacalc.ts, tables in
// data/dosing.ts. Inputs are kept as strings so decimals type cleanly.

const num = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};
const r = (n: number, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : "—");
const clamp = (v: number, [min, max]: readonly [number, number]) =>
  Math.min(max, Math.max(min, v || min));

type TabId =
  | "volume" | "substrate" | "water" | "convert"
  | "ferts" | "co2" | "remin"
  | "filter" | "heater" | "light"
  | "composition" | "stocking";

const GROUPS: { title: string; tabs: [TabId, string][] }[] = [
  { title: "Water & volume", tabs: [["volume", "Volume"], ["substrate", "Substrate"], ["water", "Water change"], ["convert", "Converter"]] },
  { title: "Dosing & chemistry", tabs: [["ferts", "Fertilizer"], ["co2", "CO₂"], ["remin", "Remineralize"]] },
  { title: "Equipment", tabs: [["filter", "Filter"], ["heater", "Heater"], ["light", "Lighting"]] },
  { title: "Composition", tabs: [["composition", "Composition"], ["stocking", "Stocking"]] },
];

/* ---------------- shared atoms ---------------- */

function Num({
  label, value, onChange, unit, step = "any",
}: {
  label: string; value: string; onChange: (v: string) => void;
  unit?: string; step?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-stone">
      <span>{label}{unit ? ` (${unit})` : ""}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-mist/10 bg-mist/[0.06] px-2 py-1.5 text-sm text-mist outline-none focus:border-aqua/50"
      />
    </label>
  );
}

function Out({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-mist/5 py-1.5">
      <span className="text-[11px] text-stone">{label}</span>
      <span className={`font-mono text-sm ${accent ? "text-aqua" : "text-mist"}`}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="mb-2 text-[10px] uppercase tracking-[0.18em] text-moss/90">{title}</h3>
      {children}
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-[10px] leading-relaxed text-stone/60">{children}</p>;
}

function Grid({ children, cols = 2 }: { children: ReactNode; cols?: number }) {
  return <div className={`grid gap-2.5 ${cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>{children}</div>;
}

const selectCls =
  "rounded-md border border-mist/10 bg-mist/[0.06] px-2 py-1.5 text-sm text-mist outline-none";

/* ---------------- tabs ---------------- */

function VolumeTab() {
  const tank = useStudioStore((s) => s.tank);
  const substrate = useStudioStore((s) => s.substrate);
  const setTank = useStudioStore((s) => s.setTank);
  const [w, setW] = useState(String(tank.width));
  const [d, setD] = useState(String(tank.depth));
  const [h, setH] = useState(String(tank.height));
  const [fill, setFill] = useState("90");
  const [subL, setSubL] = useState(
    r(calc.substrateLiters(tank.width, tank.depth, (substrate.depthFront + substrate.depthBack) / 2), 1),
  );
  const [hard, setHard] = useState("0");

  const gross = calc.grossLiters(num(w), num(d), num(h));
  const net = calc.netLiters(gross, num(fill) / 100, num(subL), num(hard));

  return (
    <>
      <Section title="Tank dimensions">
        <Grid cols={3}>
          <Num label="Width" unit="cm" value={w} onChange={setW} />
          <Num label="Depth" unit="cm" value={d} onChange={setD} />
          <Num label="Height" unit="cm" value={h} onChange={setH} />
        </Grid>
        <div className="mt-2.5">
          <Grid cols={3}>
            <Num label="Fill" unit="%" value={fill} onChange={setFill} />
            <Num label="Substrate" unit="L" value={subL} onChange={setSubL} />
            <Num label="Hardscape" unit="L" value={hard} onChange={setHard} />
          </Grid>
        </div>
        <button
          onClick={() =>
            setTank({
              width: clamp(num(w), TANK_LIMITS.width),
              depth: clamp(num(d), TANK_LIMITS.depth),
              height: clamp(num(h), TANK_LIMITS.height),
            })
          }
          className="mt-3 rounded-md bg-moss px-3 py-1.5 text-xs font-medium text-sumi hover:bg-moss-bright"
        >
          Apply to tank
        </button>
      </Section>
      <Section title="Volume">
        <Out label="Gross (full interior)" value={`${r(gross)} L`} />
        <Out label="Net water volume" value={`${r(net)} L`} accent />
        <Out label="US gallons (net)" value={r(calc.toUSgal(net))} />
        <Out label="UK gallons (net)" value={r(calc.toUKgal(net))} />
        <Note>
          Net = gross × fill% − substrate − hardscape. Dosing &amp; stocking
          should use the net figure, not the glass volume.
        </Note>
      </Section>
    </>
  );
}

function SubstrateTab() {
  const tank = useStudioStore((s) => s.tank);
  const substrate = useStudioStore((s) => s.substrate);
  const setSubstrate = useStudioStore((s) => s.setSubstrate);
  const [w, setW] = useState(String(tank.width));
  const [d, setD] = useState(String(tank.depth));
  const [front, setFront] = useState(String(substrate.depthFront));
  const [back, setBack] = useState(String(substrate.depthBack));
  const [bag, setBag] = useState("9");

  const avg = (num(front) + num(back)) / 2;
  const vol = calc.substrateLiters(num(w), num(d), avg);
  const density = SUBSTRATE_DENSITY[substrate.type];

  return (
    <>
      <Section title="Bed">
        <Grid>
          <Num label="Width" unit="cm" value={w} onChange={setW} />
          <Num label="Depth" unit="cm" value={d} onChange={setD} />
          <Num label="Front depth" unit="cm" value={front} onChange={setFront} />
          <Num label="Back depth" unit="cm" value={back} onChange={setBack} />
          <Num label="Bag size" unit="L" value={bag} onChange={setBag} />
        </Grid>
        <button
          onClick={() =>
            setSubstrate({
              depthFront: clamp(num(front), [0, 30]),
              depthBack: clamp(num(back), [0, 30]),
            })
          }
          className="mt-3 rounded-md bg-moss px-3 py-1.5 text-xs font-medium text-sumi hover:bg-moss-bright"
        >
          Apply to substrate
        </button>
      </Section>
      <Section title="Quantity">
        <Out label="Average depth" value={`${r(avg)} cm`} />
        <Out label="Substrate needed" value={`${r(vol)} L`} accent />
        <Out label={`Bags (${num(bag)} L each)`} value={String(calc.bagsNeeded(vol, num(bag)))} />
        <Out label={`Weight (≈${density} kg/L, ${substrate.type})`} value={`${r(calc.substrateWeightKg(vol, density))} kg`} />
        <Note>Density is wet bulk weight; aqua soil is lighter, sand/gravel heavier.</Note>
      </Section>
    </>
  );
}

function WaterTab({ netDefault }: { netDefault: number }) {
  const [vol, setVol] = useState(r(netDefault));
  const [pct, setPct] = useState("50");
  const [cur, setCur] = useState("40");
  const [tgt, setTgt] = useState("20");
  const [perL, setPerL] = useState("40");
  const [perDose, setPerDose] = useState("1");

  const changeL = calc.changeLiters(num(vol), num(pct));
  const n = calc.changesToTarget(num(cur), num(tgt), num(pct));

  return (
    <>
      <Section title="Water change">
        <Grid>
          <Num label="Net volume" unit="L" value={vol} onChange={setVol} />
          <Num label="Change" unit="%" value={pct} onChange={setPct} />
        </Grid>
        <div className="mt-2">
          <Out label="Water to swap each change" value={`${r(changeL)} L`} accent />
        </div>
      </Section>
      <Section title="Dilution — reach a target">
        <Grid>
          <Num label="Current value" value={cur} onChange={setCur} />
          <Num label="Target value" value={tgt} onChange={setTgt} />
        </Grid>
        <div className="mt-2">
          <Out
            label={`${num(pct)}% changes needed`}
            value={Number.isNaN(n) ? "—" : String(n)}
            accent
          />
        </div>
        <Note>e.g. lowering nitrate / clearing medication or tannins. Assumes no new input between changes.</Note>
      </Section>
      <Section title="Dechlorinator">
        <Grid>
          <Num label="Dose" unit="mL" value={perDose} onChange={setPerDose} />
          <Num label="per" unit="L" value={perL} onChange={setPerL} />
        </Grid>
        <div className="mt-2">
          <Out label="Dose for this change" value={`${r(calc.dechlorMl(changeL, num(perL), num(perDose)), 1)} mL`} />
        </div>
      </Section>
    </>
  );
}

function FertsTab({ netDefault }: { netDefault: number }) {
  const [saltId, setSaltId] = useState(SALTS[0].id);
  const [liters, setLiters] = useState(r(netDefault));
  const [grams, setGrams] = useState("1");
  const [targetPpm, setTargetPpm] = useState("10");
  const salt = SALTS.find((s) => s.id === saltId) ?? SALTS[0];
  const elements = Object.entries(salt.fractions);
  const primary = elements[0];

  return (
    <>
      <Section title="Dry salt → ppm">
        <div className="mb-2.5 flex flex-col gap-1 text-[11px] text-stone">
          <span>Salt</span>
          <select
            value={saltId}
            onChange={(e) => setSaltId(e.target.value)}
            className={selectCls}
            style={{ colorScheme: "dark" }}
          >
            {SALTS.map((s) => (
              <option key={s.id} value={s.id} className="bg-soil">{s.label}</option>
            ))}
          </select>
        </div>
        <Grid>
          <Num label="Net volume" unit="L" value={liters} onChange={setLiters} />
          <Num label="Dose" unit="g" value={grams} onChange={setGrams} />
        </Grid>
        <div className="mt-2">
          {elements.map(([el, frac]) => (
            <Out key={el} label={`${el} added`} value={`${r(calc.saltPpm(num(grams), frac, num(liters)), 2)} ppm`} accent={el === primary[0]} />
          ))}
        </div>
      </Section>
      <Section title={`Reach a target ${primary[0]} ppm`}>
        <Num label={`Target ${primary[0]}`} unit="ppm" value={targetPpm} onChange={setTargetPpm} />
        <div className="mt-2">
          <Out
            label={`${salt.label.split(" ")[0]} needed`}
            value={`${r(calc.saltGrams(num(targetPpm), primary[1], num(liters)), 3)} g`}
            accent
          />
        </div>
      </Section>
      <Section title="EI weekly targets (ppm)">
        <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-[11px]">
          {EI_TARGETS.map((t) => (
            <div key={t.el} className="flex justify-between">
              <span className="text-stone">{t.el}</span>
              <span className="font-mono text-mist/80">{t.lo}–{t.hi}</span>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

function Co2Tab() {
  const [pH, setPH] = useState("6.8");
  const [kh, setKh] = useState("4");
  const [targetCo2, setTargetCo2] = useState("30");
  const co2 = calc.co2ppm(num(pH), num(kh));
  const band =
    co2 < 15 ? "low — plants want more" : co2 > 40 ? "DANGER — risky for fish" : co2 > 30 ? "high" : "good (15–30 ppm)";

  return (
    <>
      <Section title="CO₂ from pH & KH">
        <Grid>
          <Num label="Tank pH" value={pH} onChange={setPH} />
          <Num label="KH" unit="dKH" value={kh} onChange={setKh} />
        </Grid>
        <div className="mt-2">
          <Out label="Dissolved CO₂" value={`${r(co2)} ppm`} accent />
          <Out label="Reading" value={band} />
        </div>
        <Note>Drop-checker green ≈ 30 ppm. CO₂ ≈ 3·KH·10^(7−pH). Above ~40 ppm stresses livestock.</Note>
      </Section>
      <Section title="pH needed for a target CO₂">
        <Num label="Target CO₂" unit="ppm" value={targetCo2} onChange={setTargetCo2} />
        <div className="mt-2">
          <Out label={`pH at ${num(kh)} dKH`} value={r(calc.phForCo2(num(targetCo2), num(kh)), 2)} accent />
        </div>
      </Section>
    </>
  );
}

function ReminTab({ netDefault }: { netDefault: number }) {
  const [prodId, setProdId] = useState(REMIN_PRODUCTS[0].id);
  const [liters, setLiters] = useState(r(netDefault));
  const [delta, setDelta] = useState("3");
  const prod = REMIN_PRODUCTS.find((p) => p.id === prodId) ?? REMIN_PRODUCTS[0];
  const [rate, setRate] = useState(String(prod.ratePerDegPerL));

  const grams = calc.reminGrams(num(rate), num(delta), num(liters));

  return (
    <>
      <Section title="GH / KH remineralization">
        <div className="mb-2.5 flex flex-col gap-1 text-[11px] text-stone">
          <span>Product</span>
          <select
            value={prodId}
            onChange={(e) => {
              const id = e.target.value;
              setProdId(id);
              const p = REMIN_PRODUCTS.find((x) => x.id === id);
              if (p) setRate(String(p.ratePerDegPerL));
            }}
            className={selectCls}
            style={{ colorScheme: "dark" }}
          >
            {REMIN_PRODUCTS.map((p) => (
              <option key={p.id} value={p.id} className="bg-soil">{p.label} — raises {p.raises}</option>
            ))}
          </select>
        </div>
        <Grid>
          <Num label="Net volume" unit="L" value={liters} onChange={setLiters} />
          <Num label={`Raise ${prod.raises}`} unit="°" value={delta} onChange={setDelta} />
          <Num label="Rate" unit="g/°/L" value={rate} onChange={setRate} />
        </Grid>
        <div className="mt-2">
          <Out label="Additive needed" value={`${r(grams, 2)} g`} accent />
        </div>
        {prod.note && <Note>{prod.note}</Note>}
        <Note>1 dGH/dKH ≈ {calc.PPM_CACO3_PER_DEGREE} ppm CaCO₃. Rate is editable — always verify against the product label.</Note>
      </Section>
    </>
  );
}

function FilterTab({ netDefault }: { netDefault: number }) {
  const [vol, setVol] = useState(r(netDefault));
  const [flow, setFlow] = useState("600");
  const [target, setTarget] = useState("8");
  const to = calc.turnover(num(flow), num(vol));
  const needed = calc.flowForTurnover(num(vol), num(target));

  return (
    <>
      <Section title="Turnover from a filter">
        <Grid>
          <Num label="Net volume" unit="L" value={vol} onChange={setVol} />
          <Num label="Filter flow" unit="L/h" value={flow} onChange={setFlow} />
        </Grid>
        <div className="mt-2">
          <Out label="Turnover" value={`${r(to)}× / hour`} accent />
        </div>
        <Note>Planted aquariums aim for ~6–10× the tank volume per hour.</Note>
      </Section>
      <Section title="Filter for a target turnover">
        <Num label="Target turnover" unit="×/h" value={target} onChange={setTarget} />
        <div className="mt-2">
          <Out label="Real flow needed" value={`${r(needed)} L/h`} />
          <Out label="Rated flow to buy" value={`${r(calc.ratedForReal(needed))} L/h`} accent />
        </div>
        <Note>Rated flow drops to ~55% once the filter is full of media — size up accordingly.</Note>
      </Section>
    </>
  );
}

function HeaterTab({ netDefault }: { netDefault: number }) {
  const [vol, setVol] = useState(r(netDefault));
  const [delta, setDelta] = useState("6");
  const [k, setK] = useState(String(calc.DEFAULT_HEATER_K));
  const watts = calc.heaterWatts(num(vol), num(delta), num(k));

  return (
    <>
      <Section title="Heater wattage">
        <Grid cols={3}>
          <Num label="Net volume" unit="L" value={vol} onChange={setVol} />
          <Num label="Temp rise" unit="°C" value={delta} onChange={setDelta} />
          <Num label="Factor" unit="W/L/°C" value={k} onChange={setK} />
        </Grid>
        <div className="mt-2">
          <Out label="Power needed" value={`${r(watts, 0)} W`} />
          <Out label="Buy heater" value={`${calc.nextHeaterSize(watts)} W`} accent />
        </div>
        <Note>Temp rise = target − coldest room temp. Factor ≈0.2 normal room; raise it for a cold/draughty room or a tall tank.</Note>
      </Section>
    </>
  );
}

function LightTab({ netDefault }: { netDefault: number }) {
  const [vol, setVol] = useState(r(netDefault));
  const [w, setW] = useState("30");
  const [lm, setLm] = useState("2000");
  const wpl = calc.wattsPerL(num(w), num(vol));
  const lpl = calc.lumensPerL(num(lm), num(vol));

  return (
    <>
      <Section title="Light level (LED ballpark)">
        <Grid cols={3}>
          <Num label="Net volume" unit="L" value={vol} onChange={setVol} />
          <Num label="LED power" unit="W" value={w} onChange={setW} />
          <Num label="Output" unit="lm" value={lm} onChange={setLm} />
        </Grid>
        <div className="mt-2">
          <Out label="Watts / litre" value={`${r(wpl, 2)} (${classifyBand(wpl, LIGHT_BANDS.wattsPerL)})`} accent />
          <Out label="Lumens / litre" value={`${r(lpl, 0)} (${classifyBand(lpl, LIGHT_BANDS.lumensPerL)})`} />
        </div>
        <Note>Rough guide only — real light intensity is PAR and needs a meter. Use as a low-light vs high-tech ballpark.</Note>
      </Section>
    </>
  );
}

function ConvertTab() {
  const [cm, setCm] = useState("60");
  const [l, setL] = useState("100");
  const [c, setC] = useState("24");
  const [deg, setDeg] = useState("4");
  return (
    <>
      <Section title="Length">
        <Num label="Centimetres" value={cm} onChange={setCm} />
        <div className="mt-2"><Out label="Inches" value={r(calc.cmToIn(num(cm)), 2)} accent /></div>
      </Section>
      <Section title="Volume">
        <Num label="Litres" value={l} onChange={setL} />
        <div className="mt-2">
          <Out label="US gallons" value={r(calc.toUSgal(num(l)), 2)} accent />
          <Out label="UK gallons" value={r(calc.toUKgal(num(l)), 2)} />
        </div>
      </Section>
      <Section title="Temperature">
        <Num label="Celsius" value={c} onChange={setC} />
        <div className="mt-2"><Out label="Fahrenheit" value={r(calc.cToF(num(c)), 1)} accent /></div>
      </Section>
      <Section title="Hardness">
        <Num label="Degrees (dGH/dKH)" value={deg} onChange={setDeg} />
        <div className="mt-2"><Out label="ppm CaCO₃" value={r(calc.degToPpmCaCO3(num(deg)), 1)} accent /></div>
      </Section>
    </>
  );
}

function CompositionTab() {
  const tank = useStudioStore((s) => s.tank);
  const [gw1, gw2] = calc.goldenPoints(tank.width);
  const [tw1, tw2] = calc.thirdsPoints(tank.width);
  const [gh1, gh2] = calc.goldenPoints(tank.height);
  return (
    <>
      <Section title="Focal points (from the left, cm)">
        <Out label="Golden ratio" value={`${r(gw1)} · ${r(gw2)} cm`} accent />
        <Out label="Rule of thirds" value={`${r(tw1)} · ${r(tw2)} cm`} />
        <Note>Place the main stone / focal point on one of these vertical lines — never dead centre. Matches the front-glass guides.</Note>
      </Section>
      <Section title="Height lines (from the substrate, cm)">
        <Out label="Golden ratio" value={`${r(gh1)} · ${r(gh2)} cm`} />
        <Note>A good hardscape peak / horizon sits near the upper golden line ({r(gh2)} cm).</Note>
      </Section>
    </>
  );
}

function StockingTab({ netDefault }: { netDefault: number }) {
  const [vol, setVol] = useState(r(netDefault));
  const [k, setK] = useState("1");
  return (
    <Section title="Rough stocking guide">
      <Grid>
        <Num label="Net volume" unit="L" value={vol} onChange={setVol} />
        <Num label="Litres per cm of fish" value={k} onChange={setK} />
      </Grid>
      <div className="mt-2">
        <Out label="Total small-fish length" value={`≈ ${r(calc.stockingMaxCm(num(vol), num(k)), 0)} cm`} accent />
      </div>
      <Note>
        A loose guideline only. Real capacity depends on species, adult size,
        bioload, filtration and planting — research each fish and stock slowly.
      </Note>
    </Section>
  );
}

/* ---------------- shell ---------------- */

export function CalculatorOverlay({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<TabId>("volume");
  const tank = useStudioStore((s) => s.tank);
  const substrate = useStudioStore((s) => s.substrate);

  // Net-volume estimate from the live scape, used as the default for the
  // chemistry / equipment tabs.
  const gross = calc.grossLiters(tank.width, tank.depth, tank.height);
  const subL = calc.substrateLiters(
    tank.width, tank.depth, (substrate.depthFront + substrate.depthBack) / 2,
  );
  const estNet = calc.netLiters(gross, 0.9, subL, 0);

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex flex-col bg-sumi/95 backdrop-blur-xl">
      <header className="flex items-center gap-4 border-b border-mist/10 px-6 py-4">
        <div>
          <h1 className="font-display text-xl tracking-wide text-mist">Aquascape Calculators</h1>
          <p className="text-[11px] text-stone/80">
            Pre-filled from your tank ({tank.width}×{tank.depth}×{tank.height} cm · ≈{r(estNet)} L net)
          </p>
        </div>
        <button
          onClick={onClose}
          className="ml-auto rounded-md border border-mist/15 bg-mist/[0.06] px-3 py-1.5 text-xs text-mist/85 transition-colors hover:bg-mist/[0.12]"
          aria-label="Close calculators"
        >
          ✕ Close
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* nav */}
        <nav className="calm-scroll w-52 shrink-0 overflow-y-auto border-r border-mist/10 px-3 py-4">
          {GROUPS.map((g) => (
            <div key={g.title} className="mb-4">
              <div className="mb-1.5 px-2 text-[9px] uppercase tracking-[0.18em] text-stone/60">{g.title}</div>
              {g.tabs.map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`mb-0.5 block w-full rounded-md px-3 py-1.5 text-left text-xs transition-colors ${
                    tab === id ? "bg-moss text-sumi" : "text-mist/80 hover:bg-mist/[0.08]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* content */}
        <div className="calm-scroll flex-1 overflow-y-auto px-8 py-6">
          <div className="mx-auto max-w-md">
            {tab === "volume" && <VolumeTab />}
            {tab === "substrate" && <SubstrateTab />}
            {tab === "water" && <WaterTab netDefault={estNet} />}
            {tab === "convert" && <ConvertTab />}
            {tab === "ferts" && <FertsTab netDefault={estNet} />}
            {tab === "co2" && <Co2Tab />}
            {tab === "remin" && <ReminTab netDefault={estNet} />}
            {tab === "filter" && <FilterTab netDefault={estNet} />}
            {tab === "heater" && <HeaterTab netDefault={estNet} />}
            {tab === "light" && <LightTab netDefault={estNet} />}
            {tab === "composition" && <CompositionTab />}
            {tab === "stocking" && <StockingTab netDefault={estNet} />}
          </div>
        </div>
      </div>
    </div>
  );
}
