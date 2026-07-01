import { ThemeProvider } from './context/ThemeContext';
import { NavigationProvider } from './context/NavigationContext';
import { MemoryProvider } from './context/MemoryContext';
import Chassis from './components/Chassis/Chassis';

/**
 * App — Root component.
 * Wraps global providers: ThemeProvider → NavigationProvider → Chassis.
 */
export default function App() {
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
