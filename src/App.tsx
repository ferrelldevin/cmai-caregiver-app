import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { DataScreen } from "./ui/DataScreen";
import { LogScreen } from "./ui/LogScreen";
import { Icon, type IconName } from "./ui/Icon";
import { PatientAvatar, residentColor } from "./ui/PatientAvatar";
import { PatientSheet } from "./ui/PatientSheet";
import { patientPosition } from "./data/patients";
import { useCmaiData } from "./ui/useCmaiData";
import { useRoute, type DataPage, type Tab } from "./ui/route";
import { CaregiverPage, WhoSheet } from "./ui/CaregiverScreen";
import { SignInScreen } from "./ui/SignInScreen";
import { RatingScreen } from "./ui/RatingScreen";
import { ratingsDue as findRatingsDue } from "./data/caregiverRatings";
import { endSession, readSession, startSession } from "./data/session";
import { activeCaregivers, chooseLoggingCaregiver, myResidents, readLoggingCaregiver } from "./data/caregivers";
import type { Caregiver } from "./data/db";
import { study } from "./study/settings";

// The PIN needs caregivers to sign in as (plan 5.3).
const PIN_ON = study.pin && study.caregiverProfiles;
// The charts library is only needed on Scores, so it loads there, not on first open. The service worker
// still caches the chunk, so Scores works offline after the first visit to the installed app.
const ScoresScreen = lazy(() => import("./ui/ScoresScreen").then((m) => ({ default: m.ScoresScreen })));
const ScoresLoading = ({ error }: { error?: string | null }) => (
  <div className="loading" role="status">
    {error ? "Scores are unavailable while saved data cannot be read." : "Loading scores…"}
  </div>
);

const TABS: { id: Tab; label: string; title: string; icon: IconName }[] = [
  { id: "log", label: "Log", title: "Log a behavior", icon: "plus" },
  { id: "scores", label: "Score", title: "Score", icon: "chart" },
  { id: "data", label: "Settings", title: "Settings", icon: "settings" },
];

const PAGE_TITLES: Record<DataPage, string> = {
  backup: "Backup and export",
  display: "Display",
  safe: "Keep data safe",
  demo: "Demo data",
  about: "How ratings are worked out",
  caregivers: "Caregivers",
};

const readSaved = () => {
  try {
    return localStorage.getItem("cmai-patient");
  } catch {
    return null;
  }
};

export default function App() {
  const [patientId, setPatientId] = useState<string | null>(readSaved);
  const { route, go, back } = useRoute(() => ({ tab: readSaved() ? "log" : "data", page: null }));
  const tab = route.tab;
  // The Scores period chosen for each patient, so leaving Scores and coming back keeps it.
  const scoresPeriod = useRef<Record<string, number>>({});
  if (route.tab === "scores" && route.period && patientId) scoresPeriod.current[patientId] = route.period;
  const scoresRoute = (id: string | null) => ({
    tab: "scores" as const,
    page: null,
    period: id ? scoresPeriod.current[id] : undefined,
  });
  const setTab = (t: Tab) => go(t === "scores" ? scoresRoute(patientId) : { tab: t, page: null });
  const { patients, observations, checkins, windows, refresh, loaded, everLoaded, error } = useCmaiData(patientId);
  const mainRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    try {
      if (patientId) localStorage.setItem("cmai-patient", patientId);
      else localStorage.removeItem("cmai-patient");
    } catch {
      /* private mode */
    }
  }, [patientId]);

  useEffect(() => {
    if (!loaded) return;
    if (patients.length && !patients.some((p) => p.id === patientId)) setPatientId(patients[0].id);
    if (!patients.length && patientId) setPatientId(null);
  }, [loaded, patients, patientId]);

  // A new screen starts at the top, and screen readers land on its heading.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
  }, [tab, route.page]);

  const hasPatient = !!patientId && patients.some((p) => p.id === patientId);

  // Caregiver profiles (R2, plan 5.2): only with the switch on. Who is logging is remembered on
  // this phone; every new record carries their code. Nothing here ever stands between a caregiver
  // and a tile: switching is a choice, never a prompt.
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [caregiversVersion, setCaregiversVersion] = useState(0);
  const [loggingAs, setLoggingAs] = useState<string | null>(() => {
    // With the PIN on, only a sign-in from this shift counts (plan 5.3).
    const saved = !study.caregiverProfiles ? null : PIN_ON ? (readSession()?.id ?? null) : readLoggingCaregiver();
    chooseLoggingCaregiver(saved);
    return saved;
  });
  const [choosingWho, setChoosingWho] = useState(false);
  const [choosingWhoByKey, setChoosingWhoByKey] = useState(false);
  const [mine, setMine] = useState<string[]>([]);
  const [caregiversLoaded, setCaregiversLoaded] = useState(!PIN_ON);
  // With the PIN on: whose keypad is open (null: the list), and whether going back is allowed.
  const [signingIn, setSigningIn] = useState<{ id: string | null } | null>(null);
  useEffect(() => {
    if (!study.caregiverProfiles) return;
    let live = true;
    activeCaregivers()
      .then((list) => {
        if (!live) return;
        setCaregivers(list);
        setCaregiversLoaded(true);
        // A caregiver removed since, or never on this phone, is not logging.
        if (loggingAs && !list.some((c) => c.id === loggingAs)) logAs(null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on a change, not on every pick
  }, [caregiversVersion]);
  function logAs(id: string | null) {
    chooseLoggingCaregiver(id);
    setLoggingAs(id);
    if (PIN_ON && !id) endSession();
  }
  /** Switching to another caregiver: straight away, or through their PIN with the PIN on. */
  function requestLogAs(id: string | null) {
    if (!PIN_ON || !id) return logAs(id);
    setSigningIn({ id });
  }
  function signedIn(id: string) {
    startSession(id);
    logAs(id);
    setSigningIn(null);
    setCaregiversVersion((v) => v + 1);
    const c = caregivers.find((x) => x.id === id);
    setNotice(`${c?.initials ?? id} is logging`);
  }
  // A shift lasts 12 hours: checked each minute and whenever the app comes back to the front.
  useEffect(() => {
    if (!PIN_ON || !loggingAs) return;
    const check = () => {
      if (readSession()?.id !== loggingAs) logAs(null);
    };
    const t = setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", check);
    };
  }, [loggingAs]);
  const me = caregivers.find((c) => c.id === loggingAs);
  // Two-week ratings the caregiver logging now still owes for the open resident (F-47, plan 5.4).
  const RATING_ON = study.blindCmai && study.caregiverProfiles;
  const [due, setDue] = useState<number[]>([]);
  const duePatient = patients.find((p) => p.id === patientId);
  useEffect(() => {
    if (!RATING_ON || !duePatient || !loggingAs) return setDue([]);
    let live = true;
    findRatingsDue(duePatient, loggingAs, Date.now())
      .then((d) => live && setDue(d))
      .catch(() => live && setDue([]));
    return () => {
      live = false;
    };
  }, [RATING_ON, duePatient, loggingAs, observations, route.rating]);
  const initialsOf = Object.fromEntries(caregivers.map((c) => [c.id, c.initials]));

  // The section bars pin just under the patient banner, so they need its height.
  useEffect(() => {
    const el = pinRef.current;
    const set = () => document.documentElement.style.setProperty("--pin-h", `${el ? el.offsetHeight : 0}px`);
    set();
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasPatient]);

  // Switching patient: close the sheet, then say who is now open (announced, and a banner flash).
  const [choosing, setChoosing] = useState(false);
  const [choosingByKey, setChoosingByKey] = useState(false);
  const [notice, setNotice] = useState("");
  const [switched, setSwitched] = useState(false);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => {
      setNotice("");
      setSwitched(false);
    }, 4000);
    return () => clearTimeout(t);
  }, [notice]);

  async function openSwitcher(viaKeyboard: boolean) {
    setChoosingByKey(viaKeyboard);
    setChoosing(true);
    if (study.caregiverProfiles && loggingAs) setMine(await myResidents(loggingAs).catch(() => []));
    else setMine([]);
  }

  function pickPatient(id: string) {
    setChoosing(false);
    if (id === patientId) return;
    setPatientId(id);
    // A period number belongs to one patient: Scores reopens on this patient's own choice.
    if (route.tab === "scores") go(scoresRoute(id));
    setNotice(`Now on ${id}`);
    setSwitched(true);
  }

  function onTab(id: Tab) {
    if (id !== tab) return setTab(id);
    // Tapping the tab you are on: leave a Data page, or go back to the top (iOS convention).
    if (route.page) return back();
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  const shown: Tab = hasPatient ? tab : "data";
  const current = patients.find((p) => p.id === patientId);

  const pos = current ? patientPosition(current.anchor, Date.now()) : null;
  const periodLine = pos ? `Period ${pos.period} · day ${pos.day} of 14` : "";

  // With the PIN on and caregivers on the phone, nothing of the app shows until someone signs in.
  if (PIN_ON && !caregiversLoaded) return null;
  if (PIN_ON && caregivers.length > 0 && (!loggingAs || signingIn)) {
    return (
      <SignInScreen
        caregivers={caregivers}
        start={signingIn?.id ?? null}
        onCancel={loggingAs ? () => setSigningIn(null) : undefined}
        onSignedIn={signedIn}
      />
    );
  }

  return (
    <div className="app">
      {/* The app's name shows only before a patient exists. After that the resident bar is the
          top of every screen (design note 008: the patient's identity, not the brand, comes first). */}
      {!hasPatient && (
        <header className="top">
          <div className="brand">
            <img src="icon.svg" alt="" width="28" height="28" />
            <b>CMAI Tracker</b>
          </div>
        </header>
      )}

      {hasPatient && current && (
        <div className="pin" ref={pinRef} data-res={residentColor(current.id)}>
          {study.caregiverProfiles ? (
            <div className="pin-row">
              <button
                className={switched ? "pt-banner switched" : "pt-banner"}
                aria-haspopup="dialog"
                onClick={(e) => openSwitcher(e.detail === 0)}
              >
                <PatientAvatar id={current.id} />
                <span className="pt-id">
                  <b>{current.id}</b>
                  {current.demo && <span className="tag">demo</span>}
                  <span className="pt-meta">
                    {tab === "scores" ? "Current: " : ""}
                    {periodLine}
                  </span>
                </span>
                <span className="pt-switch" aria-hidden>
                  <Icon name="swap" size={18} /> {patients.length > 1 ? "Switch" : "Patients"}
                </span>
                <span className="sr">Choose patient</span>
              </button>
              <button
                className={me ? "cg-chip" : "cg-chip none"}
                aria-haspopup="dialog"
                aria-label={me ? `${me.initials}, logging as ${me.id}. Switch caregiver` : "Who? Choose who is logging"}
                onClick={(e) => {
                  if (!caregivers.length) return go({ tab: "data", page: "caregivers" });
                  setChoosingWhoByKey(e.detail === 0);
                  setChoosingWho(true);
                }}
              >
                {me ? me.initials : "Who?"}
              </button>
            </div>
          ) : (
            <button
              className={switched ? "pt-banner switched" : "pt-banner"}
              aria-haspopup="dialog"
              onClick={(e) => openSwitcher(e.detail === 0)}
            >
              <PatientAvatar id={current.id} />
              <span className="pt-id">
                <b>{current.id}</b>
                {current.demo && <span className="tag">demo</span>}
                <span className="pt-meta">
                  {tab === "scores" ? "Current: " : ""}
                  {periodLine}
                </span>
              </span>
              <span className="pt-switch" aria-hidden>
                <Icon name="swap" size={18} /> {patients.length > 1 ? "Switch" : "Patients"}
              </span>
              <span className="sr">Choose patient</span>
            </button>
          )}
          <p className={notice ? "switch-notice on" : "switch-notice"} role="status">
            {notice && (
              <>
                <Icon name="check" size={16} /> {notice}
              </>
            )}
          </p>
        </div>
      )}

      {error && (
        <div className="banner" role="alert">
          <b>This browser is not letting the app save data.</b> Private browsing, a full phone, or blocked site data can
          cause this. Open the app in a normal Safari or Chrome window and try again.
          <span className="muted"> Details: {error}</span>
        </div>
      )}

      <main ref={mainRef} tabIndex={-1} aria-busy={!everLoaded}>
        <h1 className="sr">
          {route.rating && RATING_ON
            ? "Two-week rating"
            : shown === "data" && route.page
              ? PAGE_TITLES[route.page]
              : TABS.find((t) => t.id === shown)!.title}
          {current ? `, ${current.id}` : ""}
        </h1>
        {!everLoaded ? (
          <div className="loading" role="status">
            <span className="spinner" aria-hidden /> Loading…
          </div>
        ) : shown === "data" ? (
          <DataScreen
            patients={patients}
            current={hasPatient ? patientId : null}
            page={route.page}
            pageTitle={route.page ? PAGE_TITLES[route.page] : ""}
            onPage={(page) => go({ tab: "data", page })}
            onBack={back}
            onPatient={(id) => {
              pickPatient(id);
              setTab("log");
            }}
            onChange={refresh}
            caregivers={
              study.caregiverProfiles
                ? {
                    status: caregivers.length
                      ? `${caregivers.length} on this phone${me ? ` · ${me.initials} logging` : ""}`
                      : "Add the first caregiver",
                    page: (
                      <CaregiverPage
                        caregivers={caregivers}
                        loggingAs={loggingAs}
                        patients={patients}
                        onLogAs={requestLogAs}
                        onChange={() => setCaregiversVersion((v) => v + 1)}
                      />
                    ),
                  }
                : undefined
            }
          />
        ) : shown === "log" && route.rating && RATING_ON ? (
          (() => {
            const p = patients.find((x) => x.id === route.rating!.patientId);
            if (!p || !me)
              return <p className="msg">{!p ? "No such resident on this phone." : "Choose who is logging first."}</p>;
            return (
              <RatingScreen
                key={`${p.id}-${route.rating!.period}-${me.id}`}
                patient={p}
                period={route.rating!.period}
                by={me.id}
                byInitials={me.initials}
                onDone={() => go({ tab: "log", page: null })}
              />
            );
          })()
        ) : shown === "log" ? (
          <LogScreen
            patientId={patientId!}
            observations={observations}
            checkins={checkins}
            onChange={refresh}
            initialsOf={study.caregiverProfiles ? initialsOf : undefined}
            ratingsDue={due}
            onRate={
              RATING_ON
                ? (n) => go({ tab: "log", page: null, rating: { patientId: patientId!, period: n } })
                : undefined
            }
          />
        ) : loaded && !error ? (
          <Suspense fallback={<ScoresLoading />}>
            <ScoresScreen
              key={patientId}
              patientId={patientId!}
              windows={windows}
              observations={observations}
              hasActivity={observations.length > 0 || checkins.length > 0}
              period={route.period}
              onPeriod={(n) => go({ tab: "scores", page: null, period: n })}
              onLog={() => setTab("log")}
            />
          </Suspense>
        ) : (
          <ScoresLoading error={error} />
        )}
      </main>

      <PatientSheet
        viaKeyboard={choosingByKey}
        open={choosing}
        patients={patients}
        current={hasPatient ? patientId : null}
        mine={mine}
        onPick={pickPatient}
        onManage={() => {
          setChoosing(false);
          go({ tab: "data", page: null });
        }}
        onClose={() => setChoosing(false)}
      />

      {study.caregiverProfiles && (
        <WhoSheet
          open={choosingWho}
          viaKeyboard={choosingWhoByKey}
          caregivers={caregivers}
          loggingAs={loggingAs}
          onPick={(id) => {
            setChoosingWho(false);
            if (id === loggingAs) return;
            if (PIN_ON) return requestLogAs(id);
            logAs(id);
            const c = caregivers.find((x) => x.id === id);
            setNotice(`${c?.initials ?? id} is logging`);
          }}
          onSignOut={
            PIN_ON
              ? () => {
                  setChoosingWho(false);
                  logAs(null);
                }
              : undefined
          }
          onManage={() => {
            setChoosingWho(false);
            go({ tab: "data", page: "caregivers" });
          }}
          onClose={() => setChoosingWho(false)}
        />
      )}

      <nav className="tabs" aria-label="Screens">
        <div className="tabs-inner">
          {TABS.map(({ id, label, title, icon }) => (
            <button
              key={id}
              className={shown === id ? "on" : ""}
              aria-current={shown === id ? "page" : undefined}
              aria-label={title}
              onClick={() => onTab(id)}
              disabled={id !== "data" && !hasPatient}
            >
              <span className="tab-icon" aria-hidden>
                <Icon name={icon} size={22} />
              </span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
