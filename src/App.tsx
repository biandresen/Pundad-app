import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, useState, Suspense } from "react";
import { importWithRecovery } from "./lib/releaseRecovery";
import ReleaseRecoveryNotice from "./components/molecules/ReleaseRecoveryNotice";
import RouteErrorBoundary from "./components/molecules/RouteErrorBoundary";
import { ToastContainer } from "react-toastify";
import { useColorTheme } from "./contexts/ColorThemeContext";
import { useAuth } from "./contexts/AuthContext";
import { useAuthInitializer } from "./hooks/useAuthInitializer";
import Spinner from "./components/atoms/Spinner";

import Layout from "./routes/layouts/Layout";
import ProtectedRoute from "./routes/ProtectedRoute";

const NotFound = lazy(() => importWithRecovery(() => import("./routes/pages/NotFound")));
const Home = lazy(() => importWithRecovery(() => import("./routes/pages/Home")));
const Login = lazy(() => importWithRecovery(() => import("./routes/pages/Login")));
const Register = lazy(() => importWithRecovery(() => import("./routes/pages/Register")));
const ForgotPassword = lazy(() => importWithRecovery(() => import("./routes/pages/ForgotPassord")));
const ResetPassword = lazy(() => importWithRecovery(() => import("./routes/pages/ResetPassword")));
const VerifyEmail = lazy(() => importWithRecovery(() => import("./routes/pages/VerifyEmail")));
const ResendVerification = lazy(() => importWithRecovery(() => import("./routes/pages/ResendVerification")));
const About = lazy(() => importWithRecovery(() => import("./routes/pages/About")));
const PointsAndRanking = lazy(() => importWithRecovery(() => import("./routes/pages/PointsAndRanking")));
const Contact = lazy(() => importWithRecovery(() => import("./routes/pages/Contact")));
const Terms = lazy(() => importWithRecovery(() => import("./routes/pages/legal/Terms")));
const Privacy = lazy(() => importWithRecovery(() => import("./routes/pages/legal/Privacy")));
const Cookies = lazy(() => importWithRecovery(() => import("./routes/pages/legal/Cookies")));
const CommunityRules = lazy(() => importWithRecovery(() => import("./routes/pages/legal/CommunityRules")));

const DashboardLayout = lazy(() => importWithRecovery(() => import("./routes/layouts/DashboardLayout")));
const NewJoke = lazy(() => importWithRecovery(() => import("./routes/pages/dashboard/NewJoke")));
const Drafts = lazy(() => importWithRecovery(() => import("./routes/pages/dashboard/Drafts")));
const Profile = lazy(() => importWithRecovery(() => import("./routes/pages/dashboard/Profile")));
const Admin = lazy(() => importWithRecovery(() => import("./routes/pages/dashboard/Admin")));
const Badges = lazy(() => importWithRecovery(() => import("./routes/pages/dashboard/Badges")));

const JokesLayout = lazy(() => importWithRecovery(() => import("./routes/layouts/JokesLayout")));
const AllJokes = lazy(() => importWithRecovery(() => import("./routes/pages/jokes/AllJokes")));
const MyJokes = lazy(() => importWithRecovery(() => import("./routes/pages/jokes/MyJokes")));
const Popular = lazy(() => importWithRecovery(() => import("./routes/pages/jokes/Popular")));
const Search = lazy(() => importWithRecovery(() => import("./routes/pages/jokes/Search")));
const SingleJoke = lazy(() => importWithRecovery(() => import("./routes/pages/jokes/SingleJoke")));
const RandomJoke = lazy(() => importWithRecovery(() => import("./routes/pages/jokes/RandomJoke")));
const DailyJoke = lazy(() => importWithRecovery(() => import("./routes/pages/jokes/DailyJoke")));
const TrendingWeek = lazy(() => importWithRecovery(() => import("./routes/pages/jokes/TrendingWeek")));
const MostCommentedWeek = lazy(() => importWithRecovery(() => import("./routes/pages/jokes/MostCommentedWeek")));
const FastestGrowing = lazy(() => importWithRecovery(() => import("./routes/pages/jokes/FastestGrowing")));
const TopCreatorMonth = lazy(() => importWithRecovery(() => import("./routes/pages/jokes/TopCreatorMonth")));
const Leaderboard = lazy(() => importWithRecovery(() => import("./routes/pages/jokes/Leaderboard")));

const App = () => {
  useAuthInitializer();
  const { colorTheme } = useColorTheme();
  const { loading } = useAuth();

  const [sidebars, setSidebars] = useState({
    left: false,
    right: false,
  });

  // Wait for refresh check to finish
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Layout setSidebars={setSidebars}>
        <RouteErrorBoundary>
        <Suspense fallback={<><Spinner /><ReleaseRecoveryNotice /></>}>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgotPassword" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/verify-email/:token" element={<VerifyEmail />} />
            <Route path="/resend-verification" element={<ResendVerification />} />
            <Route path="/about" element={<About />} />
            <Route path="/points-and-ranking" element={<PointsAndRanking />} />
            <Route path="/contact" element={<Contact />} />

            <Route path="/legal/terms" element={<Terms />} />
            <Route path="/legal/privacy" element={<Privacy />} />
            <Route path="/legal/cookies" element={<Cookies />} />
            <Route path="/legal/rules" element={<CommunityRules />} />

            {/* Protected dashboard */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout sidebars={sidebars} setSidebars={setSidebars} />
                </ProtectedRoute>
              }
            >
              <Route index element={<NewJoke />} />
              <Route path="new-joke" element={<NewJoke />} />
              <Route path="drafts" element={<Drafts />} />
              <Route path="profile" element={<Profile />} />
              <Route path="badges" element={<Badges />} />
              <Route path="admin" element={<Admin />} />
            </Route>

            {/* Jokes */}
            <Route path="/jokes" element={<JokesLayout sidebars={sidebars} setSidebars={setSidebars} />}>
              <Route index element={<AllJokes />} />
              <Route path="search" element={<Search />} />
              <Route path="all-jokes" element={<AllJokes />} />
              <Route path="random-joke" element={<RandomJoke />} />
              <Route path="daily-joke" element={<DailyJoke />} />
              <Route path="trending-week" element={<TrendingWeek />} />
              <Route path="most-commented-week" element={<MostCommentedWeek />} />
              <Route path="fastest-growing" element={<FastestGrowing />} />
              <Route path="top-creator-month" element={<TopCreatorMonth />} />
              <Route path="popular" element={<Popular />} />
              <Route path="leaderboard" element={<Leaderboard />} />
              <Route path="my-jokes" element={<MyJokes />} />
              <Route path=":id" element={<SingleJoke />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          <ToastContainer position="bottom-right" theme={colorTheme} />
        </Suspense>
        </RouteErrorBoundary>
      </Layout>
    </BrowserRouter>
  );
};

export default App;
