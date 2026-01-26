import Admin from './pages/Admin';
import Branches from './pages/Branches';
import Console from './pages/Console';
import Display from './pages/Display';
import Home from './pages/Home';
import Kiosk from './pages/Kiosk';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Admin": Admin,
    "Branches": Branches,
    "Console": Console,
    "Display": Display,
    "Home": Home,
    "Kiosk": Kiosk,
}

export const pagesConfig = {
    mainPage: "Kiosk",
    Pages: PAGES,
    Layout: __Layout,
};