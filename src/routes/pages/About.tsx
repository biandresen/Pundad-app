import { Link } from "react-router-dom";
import aboutImg from "../../assets/img/dad-in-chair.png";
import { useLanguage } from "../../contexts/LanguageContext";

type AboutFeature = {
  title: string;
  description: string;
};

const About = () => {
  const { t, tr } = useLanguage();

  const features = tr<AboutFeature[]>("about.features", []);

  return (
    <div className="container max-w-150 flex flex-col-reverse lg:flex-row lg:max-w-235 lg:gap-10 lg:justify-self-center">
      <img
        className="mx-auto h-fit w-[calc(170px+12vw)] mt-[-20px]"
        src={aboutImg}
        alt="a dad sitting in a chair laughing"
      />

      <section className="w-full">
        <h2 className="about-heading">{t("about.heading")}</h2>
        <p className="about-paragraph">{t("about.paragraph1")}</p>
        <p className="about-paragraph">{t("about.paragraph2")}</p>
        <p className="about-paragraph">{t("about.paragraph3")}</p>
        <p className="about-paragraph">{t("about.paragraph4")}</p>
        <p className="about-paragraph">{t("about.paragraph5")}</p>
        <p className="about-paragraph">
          <Link to="/points-and-ranking" className="font-semibold underline underline-offset-4 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4">
            {t("rankingGuide.link")} <span aria-hidden="true">→</span>
          </Link>
        </p>

        <section className="mt-10">
          <h3 className="text-[var(--text1)] text-2xl font-bold mb-4">
            {t("about.featuresHeading")}
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-white/10 bg-[var(--bg-input)] p-4"
              >
                <div className="text-[var(--text1)] font-semibold mb-1">
                  {f.title}
                </div>
                <p className="text-[var(--text1)] opacity-80 text-sm leading-relaxed">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
};

export default About;
