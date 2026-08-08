import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Navbar from './portfolio/components/Navbar/Navbar';
import ErrorBoundary from './components/ui/ErrorBoundary/ErrorBoundary';
import { ToastProvider } from './components/ui/Toast/ToastProvider';
import LoadingSpinner from './components/ui/LoadingSpinner/LoadingSpinner';
import './components/ui/ui-tokens.css';

const HomePage = lazy(() => import('./portfolio/pages/HomePage/HomePage'));
const DegreePage = lazy(() => import('./portfolio/pages/DegreePage/DegreePage'));
const GamesHome = lazy(() => import('./portfolio/games/GamesHomePage/GamesHome'));
const Minesweeper = lazy(() => import('./portfolio/games/Minesweeper/Minesweeper'));
const Snake = lazy(() => import('./portfolio/games/Snake/Snake'));
const WizardArenaGame = lazy(() => import('./portfolio/games/WizardArena/WizardArenaGame'));
const ToolsHome = lazy(() => import('./portfolio/tools/ToolsHome/ToolsHome'));
const JpgToPdf = lazy(() => import('./portfolio/tools/jpg-to-pdf/JpgToPdf'));
const PdfMerge = lazy(() => import('./portfolio/tools/pdf-merge/PdfMerge'));
const QuizPage = lazy(() => import('./portfolio/tools/Quiz/QuizPage'));
const QuizAdminPage = lazy(() => import('./portfolio/tools/Quiz/QuizAdminPage'));
const AdminDashboardPage = lazy(() => import('./portfolio/admin/AdminDashboardPage'));
const AdminQuestionsPage = lazy(() => import('./portfolio/admin/AdminQuestionsPage'));
const AdminCharacterChatPage = lazy(() => import('./portfolio/admin/AdminCharacterChatPage'));

function AppRoutes() {
  const { t } = useTranslation();

  return (
    <ErrorBoundary
      title={t('common.errorBoundaryTitle')}
      message={t('common.errorBoundaryMessage')}
      actionLabel={t('common.errorBoundaryReload')}
    >
      <Suspense fallback={<LoadingSpinner label={t('Quiz.loading')} />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/degree" element={<DegreePage />} />
          <Route path="/GamesHome" element={<GamesHome />} />
          <Route path="/Minesweeper" element={<Minesweeper />} />
          <Route path="/Snake" element={<Snake />} />
          <Route path="/WizardArena3D" element={<WizardArenaGame />} />
          <Route path="/ToolsHome" element={<ToolsHome />} />
          <Route path="/toolsHome" element={<ToolsHome />} />
          <Route path="/JpgToPdf" element={<JpgToPdf />} />
          <Route path="/PdfMerge" element={<PdfMerge />} />
          <Route path="/Quiz" element={<QuizPage />} />
          <Route path="/Quiz/Admin" element={<QuizAdminPage />} />
          <Route path="/Admin" element={<AdminDashboardPage />} />
          <Route path="/Admin/questions" element={<AdminQuestionsPage />} />
          <Route path="/Admin/chat" element={<AdminCharacterChatPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Navbar />
        <div className="app-main">
          <AppRoutes />
        </div>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
