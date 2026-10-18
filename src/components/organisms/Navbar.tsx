import { NavLink } from "react-router-dom";
import { MdOutlineDarkMode, MdOutlineLightMode } from "react-icons/md";

import { useColorTheme } from "../../contexts/ColorThemeContext";
import { useUser } from "../../contexts/UserContext";
import { useLanguage } from "../../contexts/LanguageContext";

import UserMenu from "../molecules/UserMenu";
import LegalMenu from "../molecules/LegalMenu";
import { LanguageToggle } from "../atoms/LanguageToggle";

import { type NavbarProps } from "../../types/components.types";

const Navbar = ({ isOpen, setIsOpen }: NavbarProps) => {
  const { colorTheme, toggleTheme } = useColorTheme();
  const { user } = useUser();
  const { t } = useLanguage();

  const closeMobileNav = () => {
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? "navbar-link-active" : "navbar-link-inactive";

  return (
    <nav
      className={`
        ${isOpen ? "block" : "hidden"}
        z-90
        absolute top-14 left-0 w-full
        font-medium text-[1.2rem]
        bg-[var(--primary)]
        animate-in fade-in duration-300
        md:block
        md:static
        md:place-items-end
      `}
    >
      <ul className="flex flex-col md:text-[calc(0.85rem+0.25vw)] gap-4 ml-8 md:flex-row md:items-center md:gap-6 md:ml-0 w-25 md:w-auto">
        <li className="pt-3 md:pt-0">
          <NavLink to="/jokes/daily-joke" onClick={closeMobileNav} className={navClass}>
            {t("navbar.links.jokes")}
          </NavLink>
        </li>

        {user ?
          <li className="whitespace-nowrap">
            <NavLink to="/dashboard" onClick={closeMobileNav} className={navClass}>
              {t("navbar.links.dashboard")}
            </NavLink>
          </li>
        : <>
            <li>
              <NavLink to="/register" onClick={closeMobileNav} className={navClass}>
                {t("navbar.links.register")}
              </NavLink>
            </li>

            <li>
              <NavLink to="/login" onClick={closeMobileNav} className={navClass}>
                {t("navbar.links.login")}
              </NavLink>
            </li>
          </>
        }

        <li>
          <NavLink to="/about" onClick={closeMobileNav} className={navClass}>
            {t("navbar.links.about")}
          </NavLink>
        </li>

        <li>
          <NavLink to="/contact" onClick={closeMobileNav} className={navClass}>
            {t("navbar.links.contact")}
          </NavLink>
        </li>

        <li className="md:ml-2 md:mt-2 pb-4 md:pb-0">
          <LegalMenu onNavigate={closeMobileNav} />
        </li>

        <li className="pb-3 md:pb-0 mt-[-10px] md:mt-0">
          <button
            type="button"
            title={t("navbar.actions.toggleTheme")}
            aria-label={t("navbar.actions.toggleTheme")}
            onClick={() => {
              toggleTheme();
              closeMobileNav();
            }}
            className="flex items-center"
          >
            {colorTheme === "dark" ?
              <MdOutlineLightMode size={25} />
            : <MdOutlineDarkMode size={25} />}
          </button>
        </li>

        <li>
          <LanguageToggle onNavigate={closeMobileNav} />
        </li>

        <li className="md:ml-2 md:mt-2 pb-4 md:pb-0">
          <UserMenu onNavigate={closeMobileNav} />
        </li>
      </ul>
    </nav>
  );
};

export default Navbar;
