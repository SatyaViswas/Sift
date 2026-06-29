import { ThemeProvider } from './context/ThemeContext';
import { NavigationProvider } from './context/NavigationContext';
import Chassis from './components/Chassis/Chassis';

/**
 * App — Root component.
 * Wraps global providers: ThemeProvider → NavigationProvider → Chassis.
 */
export default function App() {
  return (
    <ThemeProvider>
      <NavigationProvider>
        <Chassis />
      </NavigationProvider>
    </ThemeProvider>
  );
}
