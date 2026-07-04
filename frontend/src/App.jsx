import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NavigationProvider } from './context/NavigationContext';
import { MemoryProvider } from './context/MemoryContext';
import Chassis from './components/Chassis/Chassis';
import LandingPage from './pages/LandingPage/LandingPage';

/**
 * AppShell — Rendered once auth state is resolved.
 * Shows LandingPage if logged out, full app if logged in.
 */
function AppShell() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100dvh',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'hsl(228, 30%, 5%)',
        fontFamily: "'Fraunces', Georgia, serif",
        fontSize: '1.75rem',
        fontWeight: 700,
        letterSpacing: '-0.03em',
        background: 'linear-gradient(135deg, #f5c97e, #c97d3e)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}>
          Déjà
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  return (
    <ThemeProvider>
      <NavigationProvider>
        <MemoryProvider>
          <Chassis />
        </MemoryProvider>
      </NavigationProvider>
    </ThemeProvider>
  );
}

/**
 * App — Root component.
 * AuthProvider wraps everything so useAuth() is available globally.
 */
export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
