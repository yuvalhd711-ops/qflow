import Kiosk from './pages/Kiosk';
import Console from './pages/Console';
import Display from './pages/Display';
import Admin from './pages/Admin';
import Home from './pages/Home';
import Branches from './pages/Branches';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Kiosk": Kiosk,
    "Console": Console,
    "Display": Display,
    "Admin": Admin,
    "Home": Home,
    "Branches": Branches,
}

export const pagesConfig = {
    mainPage: "Kiosk",
    Pages: PAGES,
    Layout: __Layout,
};