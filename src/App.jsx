import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useParams } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
import Products from './pages/Products';
import MaterialsListView from './pages/MaterialsListView';
import ProductDetail from './pages/ProductDetail';
import ListView from './pages/ListView';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import ColorLibrary from './pages/ColorLibrary';
import ColorPalettes from './pages/ColorPalettes';
import ColorPaletteDetail from './pages/ColorPaletteDetail';
import SizeLibrary from './pages/SizeLibrary';
import SizeGridLibrary from './pages/SizeGridLibrary';
import ListOfValuesLibrary from './pages/ListOfValuesLibrary';
import SystemCodeGeneratorLibrary from './pages/SystemCodeGeneratorLibrary';
import Translations from './pages/Translations';
import Config from './pages/Config';
import ProjectDocuments from './pages/ProjectDocuments';
import DocumentStaging from './pages/DocumentStaging';
import DocumentParsingSchemes from './pages/DocumentParsingSchemes';
import BoardEditor from './pages/BoardEditor';

const ProjectDocumentsRedirect = () => { const { id } = useParams(); return <Navigate to={`/projects/${id}`} replace />; };

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/list-view" replace />} />
        <Route path="/materials" element={<MaterialsListView />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/projects/:id/documents-to-parse" element={<ProjectDocuments />} />
        <Route path="/projects/:id/documents" element={<ProjectDocumentsRedirect />} />
        <Route path="/projects/:id/documents-to-parse/:docId" element={<DocumentStaging />} />
        <Route path="/list-view" element={<ListView />} />
        <Route path="/color-library" element={<ColorLibrary />} />
        <Route path="/color-palettes" element={<ColorPalettes />} />
        <Route path="/color-palettes/:id" element={<ColorPaletteDetail />} />
        <Route path="/size-library" element={<SizeLibrary />} />
        <Route path="/size-grid-library" element={<SizeGridLibrary />} />
        <Route path="/list-of-values" element={<ListOfValuesLibrary />} />
        <Route path="/code-generators" element={<SystemCodeGeneratorLibrary />} />
        <Route path="/translations" element={<Translations />} />
        <Route path="/config" element={<Config />} />
        <Route path="/document-parsing-schemes" element={<DocumentParsingSchemes />} />
        <Route path="/projects/:projectId/boards/:boardId" element={<BoardEditor />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App