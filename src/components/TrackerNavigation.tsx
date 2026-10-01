import { MapPin, LocateFixed, Route, BookOpen, Bookmark, Settings, Moon, Sun, LogIn, LogOut } from 'lucide-react';

export type TrackerSection = 'Places' | 'Nearby' | 'Trips' | 'Diary' | 'Pins';

const sections = [
  { name: 'Places', icon: MapPin },
  { name: 'Nearby', icon: LocateFixed },
  { name: 'Trips', icon: Route },
  { name: 'Diary', icon: BookOpen },
  { name: 'Pins', icon: Bookmark },
] as const;

interface Props {
  activeSection: TrackerSection;
  onNavigate: (section: TrackerSection) => void;
  counts: Partial<Record<TrackerSection, number>>;
  isOwner: boolean;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onSettings: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

export default function TrackerNavigation(props: Props) {
  return (
    <aside className="tracker-navigation">
      <div className="tracker-brand"><span className="brand-symbol"><MapPin size={24} strokeWidth={2} /></span><span>ToDo<span className="brand-secondary">Tracker</span></span></div>
      <nav className="section-navigation" aria-label="Main navigation">
        {sections.map(({ name, icon: Icon }) => (
          <button key={name} type="button" onClick={() => props.onNavigate(name)} className={`section-link ${props.activeSection === name ? 'is-active' : ''}`} aria-current={props.activeSection === name ? 'page' : undefined}>
            <Icon size={20} strokeWidth={props.activeSection === name ? 2.3 : 1.8} />
            <span>{name}</span>
            {props.counts[name] !== undefined && <span className="section-count">{props.counts[name]}</span>}
          </button>
        ))}
      </nav>
      <div className="navigation-footer">
        <button type="button" className="utility-link" onClick={props.onToggleTheme}>{props.isDarkMode ? <Sun size={18} /> : <Moon size={18} />} {props.isDarkMode ? 'Light mode' : 'Dark mode'}</button>
        {props.isOwner && <button type="button" className="utility-link" onClick={props.onSettings}><Settings size={18} /> Settings</button>}
        <div className="account-status"><span className="account-avatar">{props.isOwner ? <MapPin size={18} /> : <LogIn size={18} />}</span><div><strong>{props.isOwner ? 'Your tracker' : 'View only'}</strong><button type="button" onClick={props.isOwner ? props.onSignOut : props.onSignIn}>{props.isOwner ? 'Sign out' : 'Owner sign in'} {props.isOwner && <LogOut size={12} />}</button></div></div>
      </div>
    </aside>
  );
}
