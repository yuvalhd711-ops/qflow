import Admin from './pages/Admin';
import Blocked from './pages/Blocked';
import Branches from './pages/Branches';
import Console from './pages/Console';
import Display from './pages/Display';
import Home from './pages/Home';
import Kiosk from './pages/Kiosk';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Admin": Admin,
    "Blocked": Blocked,
    "Branches": Branches,
    "Console": Console,
    "Display": Display,
    "Home": Home,
    "Kiosk": Kiosk,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};