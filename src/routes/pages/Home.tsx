import { NavLink } from "react-router-dom";

import homeImg from "../../assets/img/laughing-dad-c.png";
import { useUser } from "../../contexts/UserContext";
import { useLanguage } from "../../contexts/LanguageContext";

const Home = () => {
  const { user } = useUser();
  const { t } = useLanguage();

  return (
    <div className="container md:my-auto! md:flex md:flex-row md:justify-center md:items-center sm:gap-5">
      {/* Bound fluid sizes so zooming out cannot outgrow the capped container. */}
      <img
        className="mx-auto mt-[min(3.25rem,calc(1rem+2vw))] sm:mt-10 w-[min(27.5rem,calc(13.75rem+12vw))] max-w-full md:max-w-[40%] h-auto shrink-0"
        src={homeImg}
        alt="stack of books"
      />

      <section className="w-[90%] mx-auto min-w-0 md:w-auto md:flex-1">
        <h1 className="text-[var(--text3)] text-[min(3.5rem,calc(1.8rem+1.5vw))] mt-[min(3.25rem,calc(1rem+2vw))] leading-[1.1]">
          {t("home.heading")}
        </h1>
        <p className="text-[var(--text3)] font-semibold text-[min(2.05rem,calc(0.9rem+1vw))] leading-[1.4] mt-[min(1.4rem,calc(0.5rem+0.8vw))]">
          {t("home.paragraph")}
        </p>
        <div className="flex mt-[min(3.6rem,calc(1.3rem+2vw))] gap-3 w-full md:flex-row md:w-full justify-between">
          {user ? (
            <NavLink to="/dashboard" className={"bg-[var(--button3)] text-[var(--text0)] nav-link"}>
              {t("home.button0")}
            </NavLink>
          ) : (
            <NavLink to="/register" className={"bg-[var(--button3)] text-[var(--text0)] nav-link"}>
              {t("home.button1")}
            </NavLink>
          )}

          <NavLink to="/jokes/daily-joke" className={"bg-[var(--button5)] nav-link text-[var(--text0)] outline-[var(--button3)] outline-3"}>
            {t("home.button2")}
          </NavLink>
        </div>
      </section>
    </div>
  );
};

export default Home;
