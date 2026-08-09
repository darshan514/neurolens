import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { Layout } from "./components/Layout";
import { useAuth } from "./lib/auth";
import { flushPending } from "./lib/mockApi";
import Landing from "./pages/Landing";
import Login from "./pages/Login";

// Code-split every app page so recharts/framer-motion load per-route.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ExamHub = lazy(() => import("./pages/ExamHub"));
const VoiceTest = lazy(() => import("./pages/tests/VoiceTest"));
const FingerTapTest = lazy(() => import("./pages/tests/FingerTapTest"));
const SpiralTest = lazy(() => import("./pages/tests/SpiralTest"));
const SensorTests = lazy(() => import("./pages/tests/SensorTests"));
const FacialTest = lazy(() => import("./pages/tests/FacialTest"));
const CognitiveTest = lazy(() => import("./pages/tests/CognitiveTest"));
const ReactionTest = lazy(() => import("./pages/tests/ReactionTest"));
const Results = lazy(() => import("./pages/Results"));
const History = lazy(() => import("./pages/History"));
const Medication = lazy(() => import("./pages/Medication"));
const Doctor = lazy(() => import("./pages/Doctor"));
const Settings = lazy(() => import("./pages/Settings"));
const Family = lazy(() => import("./pages/Family"));
const FindCare = lazy(() => import("./pages/FindCare"));
const Notifications = lazy(() => import("./pages/Notifications"));

function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-400/30 border-t-brand-400" />
    </div>
  );
}

function Protected({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

export default function App() {
  // flush offline-queued reports when the app boots and connectivity exists
  useEffect(() => {
    void flushPending();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />

        <Route
          element={
            <Protected>
              <Layout />
            </Protected>
          }
        >
          <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
          <Route path="/screen" element={<Suspense fallback={<PageLoader />}><ExamHub /></Suspense>} />
          <Route path="/screen/voice" element={<Suspense fallback={<PageLoader />}><VoiceTest /></Suspense>} />
          <Route path="/screen/tap" element={<Suspense fallback={<PageLoader />}><FingerTapTest /></Suspense>} />
          <Route path="/screen/spiral" element={<Suspense fallback={<PageLoader />}><SpiralTest /></Suspense>} />
          <Route path="/screen/tremor" element={<Suspense fallback={<PageLoader />}><SensorTests kind="tremor" /></Suspense>} />
          <Route path="/screen/walking" element={<Suspense fallback={<PageLoader />}><SensorTests kind="walking" /></Suspense>} />
          <Route path="/screen/balance" element={<Suspense fallback={<PageLoader />}><SensorTests kind="balance" /></Suspense>} />
          <Route path="/screen/facial" element={<Suspense fallback={<PageLoader />}><FacialTest /></Suspense>} />
          <Route path="/screen/reaction" element={<Suspense fallback={<PageLoader />}><ReactionTest /></Suspense>} />
          <Route path="/screen/cognitive" element={<Suspense fallback={<PageLoader />}><CognitiveTest /></Suspense>} />
          <Route path="/results" element={<Suspense fallback={<PageLoader />}><Results /></Suspense>} />
          <Route path="/history" element={<Suspense fallback={<PageLoader />}><History /></Suspense>} />
          <Route path="/medication" element={<Suspense fallback={<PageLoader />}><Medication /></Suspense>} />
          <Route path="/doctor" element={<Suspense fallback={<PageLoader />}><Doctor /></Suspense>} />
          <Route path="/family" element={<Suspense fallback={<PageLoader />}><Family /></Suspense>} />
          <Route path="/find-care" element={<Suspense fallback={<PageLoader />}><FindCare /></Suspense>} />
          <Route path="/notifications" element={<Suspense fallback={<PageLoader />}><Notifications /></Suspense>} />
          <Route path="/settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
