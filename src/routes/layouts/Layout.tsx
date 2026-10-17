import { useEffect, useState } from "react";

import Header from "../../components/organisms/Header";
import Modal from "../../components/molecules/Modal";
import { type LayoutProps } from "../../types/layout.types";
import { useLanguage } from "../../contexts/LanguageContext";
import LanguageRouteGate from "../../components/molecules/LanguageRouteGate";
import ContactForm from "../../components/molecules/ContactForm";

const Layout = ({ setSidebars, children }: LayoutProps) => {
  const [reportOpen, setReportOpen] = useState(false);

  const { t } = useLanguage();

  useEffect(() => {
    const isBigScreen = window.matchMedia("(min-width: 768px)");

    const handleChange = (e: MediaQueryListEvent) => {
      setSidebars(e.matches ? { left: true, right: true } : { left: false, right: false });
    };

    setSidebars(isBigScreen.matches ? { left: true, right: true } : { left: false, right: false });

    isBigScreen.addEventListener("change", handleChange);
    return () => isBigScreen.removeEventListener("change", handleChange);
  }, [setSidebars]);

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)]">
      {window.location.hostname === "staging.pundad.app" && (
        <div role="note" className="bg-[var(--warning)] text-[var(--text0)] text-center px-4 py-2 font-semibold">
          Staging · Test site. Data may be reset.
        </div>
      )}
      <Header setSidebars={setSidebars} />

      <LanguageRouteGate>
        <main className="flex flex-col mx-auto relative w-full flex-100">{children}</main>
      </LanguageRouteGate>

      {/* Sticky report button */}
      <button
        className="fixed bottom-2 left-3 xl:bottom-7 xl:left-7 z-[60] bg-[var(--button5)] text-[var(--text0)] font-bold text-[0.6rem] w-9 h-9 xl:text-sm xl:w-15 xl:h-15 rounded-full outline-2 outline-[var(--button3)] flex items-center justify-center shadow-lg hover:brightness-110"
        aria-label={t("layout.report.aria")}
        type="button"
        onClick={() => setReportOpen(true)}
      >
        {t("layout.report.button")}
      </button>

      <Modal
        isOpen={reportOpen}
        title={t("layout.report.title")}
        onClose={() => setReportOpen(false)}
        variant="custom"
      >
        <ContactForm />
      </Modal>
    </div>
  );
};

export default Layout;
