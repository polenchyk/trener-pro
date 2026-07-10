"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Oswald, Literata, JetBrains_Mono } from "next/font/google";
import styles from "./Handbook.module.css";

const oswald = Oswald({
  subsets: ["latin", "cyrillic"],
  variable: "--font-oswald",
  weight: ["400", "500", "600", "700"],
});

const literata = Literata({
  subsets: ["latin", "cyrillic"],
  variable: "--font-literata",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-jetbrains",
  weight: ["400", "500", "700"],
});

type HandbookTabId = "a" | "b" | "c" | "d" | "e";

const TABS: { id: HandbookTabId; label: string; color: HandbookTabId }[] = [
  { id: "a", label: "Філософія тренінгу", color: "a" },
  { id: "b", label: "Білок", color: "b" },
  { id: "c", label: "Жири і вода", color: "c" },
  { id: "d", label: "Суглоби і травлення", color: "d" },
  { id: "e", label: "Практика", color: "e" },
];

interface TrainerHandbookProps {
  onClose: () => void;
}

export default function TrainerHandbook({ onClose }: TrainerHandbookProps) {
  const [activeTab, setActiveTab] = useState<HandbookTabId>("a");
  const [mounted, setMounted] = useState(false);
  const tabRefs = useRef<Partial<Record<HandbookTabId, HTMLButtonElement | null>>>({});

  useEffect(() => {
    setMounted(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const selectTab = useCallback((id: HandbookTabId) => {
    setActiveTab(id);
    tabRefs.current[id]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Картотека тренера"
    >
      <button
        type="button"
        className={styles.backdrop}
        onClick={onClose}
        aria-label="Закрити картотеку"
      />
      <div
        className={`${styles.scrollShell} ${oswald.variable} ${literata.variable} ${jetbrains.variable}`}
      >
        <div className={styles.root}>
        <button
          type="button"
          onClick={onClose}
          className={styles.closeBtn}
          aria-label="Закрити картотеку"
        >
          <X size={20} />
        </button>

        <header className={styles.cover}>
          <div className={styles.coverInner}>
            <span className={`${styles.coverTag} ${styles.mono}`}>
              КАРТОТЕКА · ХАРЧУВАННЯ ТА ТРЕНУВАННЯ
            </span>
            <h1 className={styles.coverTitle}>
              Конспект
              <br />
              <span>тренера</span>
            </h1>
            <p className={styles.coverSub}>
              Зведення матеріалів семінарів С. Ліндовера, М. Гаманюка, А. Скоромного та
              В. Литвиненка + практичний блок з розрахунку раціону підопічних.
            </p>
            <div className={styles.coverMeta}>
              <span>5 розділів</span>
              <span>·</span>
              <span>
                джерело: <b>відео-семінари 2014–наш час</b>
              </span>
              <span>·</span>
              <span>
                формат: <b>довідник + калькулятор БЖУ</b>
              </span>
            </div>
          </div>
        </header>

        <nav className={styles.tabRail} aria-label="Розділи картотеки">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              ref={(el) => {
                tabRefs.current[tab.id] = el;
              }}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""}`}
              data-c={tab.color}
              onClick={() => selectTab(tab.id)}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              <span className={styles.dot} />
              {tab.label}
            </button>
          ))}
        </nav>

        <main className={styles.main}>
          {/* A. Філософія */}
          <section
            className={`${styles.panel} ${activeTab === "a" ? styles.panelActive : ""}`}
            role="tabpanel"
            hidden={activeTab !== "a"}
          >
            <div className={styles.panelHead} style={{ ["--accent" as string]: "var(--ink)" }}>
              <span className={styles.idx}>01</span>
              <h2>Філософія тренувального процесу</h2>
            </div>
            <p className={styles.panelLede}>
              За матеріалами семінару Станіслава Ліндовера, Євпаторія, 2014.
            </p>

            <div className={`${styles.card} ${styles.accentA}`}>
              <h3>
                <span className={styles.icon}>🎯</span>
                Пріоритети та доцільність
              </h3>
              <p>
                <b>Харчування і відновлення</b> — на першому місці. Без якісної нутрієнтної
                бази навіть найгеніальніший тренувальний план не спрацює.
              </p>
              <p>
                <b>Сенс тренувань — прогрес.</b> Якщо людина роками тренується без змін у формі
                чи силових показниках — план не працює, і його потрібно міняти.
              </p>
            </div>

            <div className={`${styles.card} ${styles.accentA}`}>
              <h3>
                <span className={styles.icon}>🔥</span>
                Кардіо, кросфіт і жири
              </h3>
              <ul>
                <li>
                  <b>Жири</b> необхідні для синтезу тестостерону (насичені жири) та загального
                  гормонального здоров&apos;я (омега-3).
                </li>
                <li>
                  Аеробне навантаження краще виконувати <b>після</b> силової частини — щоб не
                  витрачати енергію перед важкими підходами.
                </li>
                <li>
                  <b>Кросфіт</b> — форма кругового тренування для витривалості й оптимізації
                  ресурсів організму, але не найефективніший інструмент для гіпертрофії м&apos;язів.
                </li>
              </ul>
              <div className={styles.note}>
                Головний посил: не копіювати сліпо програми профі-атлетів — у них інші цілі,
                бюджети підготовки та біологічні можливості. Спиратись на фізіологію й
                індивідуальну реакцію організму підопічного.
              </div>
            </div>
          </section>

          {/* B. Білок */}
          <section
            className={`${styles.panel} ${activeTab === "b" ? styles.panelActive : ""}`}
            role="tabpanel"
            hidden={activeTab !== "b"}
          >
            <div className={styles.panelHead} style={{ ["--accent" as string]: "var(--rust)" }}>
              <span className={styles.idx}>02</span>
              <h2>Білок і амінокислоти</h2>
            </div>
            <p className={styles.panelLede}>
              Ліндовер (Євпаторія, 2014) + Михайло Гаманюк, лекція про функції білка.
            </p>

            <div className={`${styles.card} ${styles.accentB}`}>
              <h3>
                <span className={styles.icon}>🥩</span>
                Роль білка та дозування
              </h3>
              <p>
                Білок — основний будівельний і пластичний матеріал (м&apos;язи, гормони,
                ферменти). Організм <b>не може</b> синтезувати його з інших нутрієнтів — тому
                наявність у раціоні критична.
              </p>
              <p>
                Оптимальний фізіологічний об&apos;єм за один прийом їжі — <b>до 30–50 г</b>, з
                урахуванням індивідуальної ферментативної здатності до засвоєння.
              </p>
            </div>

            <div className={`${styles.card} ${styles.accentB}`}>
              <h3>
                <span className={styles.icon}>⏱️</span>
                «Анаболічне вікно» і BCAA
              </h3>
              <ul>
                <li>
                  Після тренування важливо максимально швидко закрити дефіцит амінокислот —
                  перевага <b>гідролізатам або ізолятам</b> протеїну.
                </li>
                <li>
                  <b>BCAA під час тренування</b> — запобігають руйнуванню м&apos;язових волокон
                  (глюконеогенезу).
                </li>
                <li>
                  Змішувати BCAA з протеїном одразу після тренування <b>не варто</b> — це
                  уповільнює швидкість засвоєння.
                </li>
              </ul>
            </div>

            <div className={styles.grid2}>
              <div className={`${styles.card} ${styles.accentB}`}>
                <h3>
                  <span className={styles.icon}>🩸</span>
                  Дефіцит білка
                </h3>
                <p>
                  Фізіологічна норма — приблизно <b>1,2 г/кг</b> ваги. Це лише база для
                  підтримки життя, не для спортивних результатів. За нестачі організм лишає
                  білок тільки на критичні процеси — ріст м&apos;язів обмежується.
                </p>
              </div>
              <div className={`${styles.card} ${styles.accentB}`}>
                <h3>
                  <span className={styles.icon}>🧬</span>
                  4 функції білка
                </h3>
                <ul>
                  <li>
                    <b>Будівельна</b> — основа всіх тканин; при дефіциті клітини, що діляться,
                    стають «атиповими».
                  </li>
                  <li>
                    <b>Транспортна</b> — альбуміни й трансферин переносять вітаміни, мінерали,
                    гормони; низький гемоглобін іноді від нестачі трансферину, а не заліза.
                  </li>
                  <li>
                    <b>Імунна</b> — антитіла це білки; потрібні всі 20 амінокислот, не лише
                    BCAA/глютамін.
                  </li>
                  <li>
                    <b>Ферментативна</b> — протеази, амілази, ліпази; без них підшлункова
                    втрачає здатність перетравлювати їжу.
                  </li>
                </ul>
              </div>
            </div>

            <div className={`${styles.card} ${styles.accentB}`}>
              <h3>
                <span className={styles.icon}>🥛</span>
                Молочні продукти та інсулін
              </h3>
              <p>
                Молочні продукти (особливо сир кисломолочний) мають високий інсуліновий відклик
                — враховувати при «сушці». Зранку, після нічного катаболізму, перший прийом їжі
                має містити легкозасвоюваний протеїн.
              </p>
              <div className={styles.note}>
                Діагностика: загальний білок крові (норма 75–85 г/л) та альбумін (~50 г/л) —
                щоб оцінити реальний білковий статус підопічного, а не орієнтуватись лише на
                добавки.
              </div>
            </div>
          </section>

          {/* C. Жири і вода */}
          <section
            className={`${styles.panel} ${activeTab === "c" ? styles.panelActive : ""}`}
            role="tabpanel"
            hidden={activeTab !== "c"}
          >
            <div className={styles.panelHead} style={{ ["--accent" as string]: "var(--olive)" }}>
              <span className={styles.idx}>03</span>
              <h2>Жири, водний баланс і добавки</h2>
            </div>
            <p className={styles.panelLede}>
              Михайло Гаманюк — терморегуляція, питний режим, дренажні добавки; Влад Литвиненко
              — вода і м&apos;язова сила.
            </p>

            <div className={styles.grid2}>
              <div className={`${styles.card} ${styles.accentC}`}>
                <h3>
                  <span className={styles.icon}>🌡️</span>
                  Жири й терморегуляція
                </h3>
                <p>
                  Жири підтримують температуру тіла (36,6°C), «згораючи» в печінці. Якщо зранку
                  температура <b>нижче 36,4°C</b> — можлива нестача жирів. Лецитин допомагає при
                  постійному відчутті холоду.
                </p>
              </div>
              <div className={`${styles.card} ${styles.accentC}`}>
                <h3>
                  <span className={styles.icon}>💊</span>
                  Трибулус як дренаж
                </h3>
                <p>
                  Трибулус (Гокшура) — не лише гормональна підтримка, а й «протинабряковий»
                  агент: покращує роботу нирок, прискорює виведення зайвої рідини.
                </p>
              </div>
            </div>

            <div className={`${styles.card} ${styles.accentC}`}>
              <h3>
                <span className={styles.icon}>💧</span>
                Питний режим
              </h3>
              <ul>
                <li>
                  Класична схема — <b>~300 мл</b> чистої води за 15–20 хв до кожного прийому
                  їжі.
                </li>
                <li>Краще вода з природними солями (джерельна) — фільтр вимиває мінерали.</li>
                <li>
                  Організм сам сигналізує баланс: хочеться пити — надлишок солей; хочеться
                  солоного — надлишок води.
                </li>
                <li>
                  При переході на правильний режим нирки активніше виводять токсини — частіше
                  сечовипускання спочатку, це нормально.
                </li>
              </ul>
            </div>

            <div className={styles.grid2}>
              <div className={`${styles.card} ${styles.accentC} ${styles.accentTeal}`}>
                <h3>
                  <span className={styles.icon}>💪</span>
                  Вода і сила на тренуванні
                </h3>
                <ul>
                  <li>
                    Зневоднення — прихована причина занепаду сил; вода акумулюється в
                    м&apos;язах, робота яких керується ЦНС.
                  </li>
                  <li>
                    Норма під час тренування: <b>чоловіки ~1–2 л</b>, <b>жінки ~0,5–1 л</b>{" "}
                    (більше при важких/витривалих навантаженнях).
                  </li>
                  <li>
                    Тест: зважитись до і після тренування без води — втрата 1 кг ваги = 750 мл
                    води.
                  </li>
                </ul>
              </div>
              <div className={`${styles.card} ${styles.accentC} ${styles.accentTeal}`}>
                <h3>
                  <span className={styles.icon}>🧠</span>
                  Мозок і жирозгоряння
                </h3>
                <p>
                  Мозок на 80% складається з води — склянка води швидше відновлює тонус, ніж
                  їжа. Брак води перевантажує нирки, частину їхньої роботи бере на себе печінка
                  — а її головне завдання при схудненні саме утилізація жирів. Тому процес
                  сповільнюється.
                </p>
                <p>
                  На високобілкових дієтах (3000–4000 ккал) — до <b>3–4 л</b> води/день, щоб
                  вимивати аміак і кетони.
                </p>
              </div>
            </div>
          </section>

          {/* D. Суглоби і травлення */}
          <section
            className={`${styles.panel} ${activeTab === "d" ? styles.panelActive : ""}`}
            role="tabpanel"
            hidden={activeTab !== "d"}
          >
            <div className={styles.panelHead} style={{ ["--accent" as string]: "var(--violet)" }}>
              <span className={styles.idx}>04</span>
              <h2>Суглоби, зв&apos;язки та травлення</h2>
            </div>
            <p className={styles.panelLede}>
              Андрій Скоромний і Михайло Гаманюк — профілактика суглобів; Гаманюк — причини
              проблем з травленням.
            </p>

            <div className={`${styles.card} ${styles.accentD}`}>
              <h3>
                <span className={styles.icon}>🦴</span>
                БАД — це профілактика, не лікування
              </h3>
              <p>
                Коли хрящ уже зруйнований, приймати хондропротектори — «пити боржомі, коли
                нирки відмовили». <b>Групи ризику:</b> люди з надмірною вагою (тиск на коліна)
                та спортсмени з великою м&apos;язовою масою (&gt;100 кг) навіть при низькому %
                жиру.
              </p>
              <p>
                Хрящ оновлюється наполовину <b>за 10 років</b> (для порівняння: білки печінки —
                за 4–8 днів). Хондроцити — лише 1% об&apos;єму тканини суглоба, і при стиранні
                їхня кількість катастрофічно падає.
              </p>
            </div>

            <div className={`${styles.card} ${styles.accentD}`}>
              <h3>
                <span className={styles.icon}>📋</span>
                Стек добавок для суглобів
              </h3>
              <ul>
                <li>
                  <b>Гідролізований колаген</b> — 5–15 г/день на постійній основі (нативний з
                  їжі засвоюється погано).
                </li>
                <li>
                  <b>Вітамін C + залізо, мідь, B3, B6</b> — для «зшивання» власних ниток
                  колагену.
                </li>
                <li>
                  <b>Глюкозамін гідрохлорид</b> (не сульфат!) — чистота 99%, біодоступність ~85%
                  проти 20–40% у сульфату, який ще й містить до 30% солі.
                </li>
                <li>
                  <b>Хондроїтин</b> — низька біодоступність (13–15%), але діє як сигнальна
                  молекула для вироблення власного колагену.
                </li>
                <li>
                  <b>Омега-3</b> — природний протизапальний засіб; при хронічних болях дозу
                  підвищують до 10–15 капсул/день (за призначенням фахівця).
                </li>
              </ul>
            </div>

            <div className={`${styles.card} ${styles.accentD}`}>
              <h3>
                <span className={styles.icon}>🏭</span>
                Травлення: конвеєр засвоєння нутрієнтів
              </h3>
              <p>
                Принцип «заводу Форда»: споживання → розщеплення → транспортування (кров,
                лімфа, білки-альбуміни) → засвоєння клітиною.
              </p>
              <div className={styles.note}>
                <b>Корінь 99% проблем — гіпоацидність</b> (нестача соляної кислоти). Білок не
                денатурується і гниє в кишечнику, блокується всмоктування заліза, кальцію,
                цинку, B12 — і далі валиться весь ланцюг, бо печінці бракує амінокислот для
                власних білків-транспортерів.
              </div>
            </div>
          </section>

          {/* E. Практика */}
          <section
            className={`${styles.panel} ${activeTab === "e" ? styles.panelActive : ""}`}
            role="tabpanel"
            hidden={activeTab !== "e"}
          >
            <div className={styles.panelHead} style={{ ["--accent" as string]: "var(--gold)" }}>
              <span className={styles.idx}>05</span>
              <h2>Практика: складання раціону</h2>
            </div>
            <p className={styles.panelLede}>
              Алгоритм складання плану харчування для підопічного + калькулятор БЖУ.
            </p>

            <div className={`${styles.card} ${styles.accentE}`}>
              <h3>
                <span className={styles.icon}>📝</span>
                Алгоритм роботи з підопічним
              </h3>
              <ul>
                <li>З&apos;ясувати раціон за один звичайний день, порахувати в калоризаторі поточне БЖУ.</li>
                <li>
                  Прибрати з раціону цукровмісне та борошняне (тверді сорти макаронів і
                  бездріжджовий хліб — можна лишити).
                </li>
                <li>Виявити непереносимість, алергії, нелюбимі продукти — і виключити їх.</li>
                <li>Скласти меню на тиждень із доступних продуктів, визначити кількість прийомів їжі.</li>
                <li>
                  Визначити харчовий тип за сніданком: <b>білково-жировий</b> (яйце + сир) чи{" "}
                  <b>вуглеводно-білковий</b> (вівсянка/макарони + яйце чи горіхи).
                </li>
                <li>Через 2–3 дні — перевірити самопочуття, енергію, голод і насичення протягом дня.</li>
              </ul>
              <div className={styles.note}>
                Головне пояснення підопічному: це <b>не дієта й не обмеження</b>, а поступова
                заміна «шкідливих» продуктів на кращі альтернативи. Овочі при підрахунку БЖУ{" "}
                <b>не рахуємо</b>. Усі продукти зважуємо в сухому/сирому вигляді.
              </div>
            </div>

            <div className={`${styles.card} ${styles.accentE}`}>
              <h3>
                <span className={styles.icon}>📊</span>
                Приклад: чоловік 25 років, 76 кг, набір маси
              </h3>
              <p>
                Норми: білок 2,5 г/кг · жири 1,3 г/кг · вуглеводи 3 г/кг →{" "}
                <b>190 г білка · ~99 г жирів · ~228 г вуглеводів.</b>
              </p>
              <table className={styles.mealTable}>
                <thead>
                  <tr>
                    <th>Прийом їжі</th>
                    <th>Продукти</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Сніданок</td>
                    <td>
                      Вівсянка 100 г (сухої) + 3 яйця + грецький горіх 35 г, зелений чай/кава
                    </td>
                  </tr>
                  <tr>
                    <td>Обід</td>
                    <td>Гречка 120 г (суха) + куряче філе 250 г (сире) + сир 60 г + салат</td>
                  </tr>
                  <tr>
                    <td>Вечеря</td>
                    <td>
                      Гречка 100 г (суха) + куряче філе 220 г (сире) + салат + оливкова олія 25
                      г
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={styles.homework}>
              <h4>Домашнє завдання — скласти меню на день</h4>
              <div className={styles.case}>
                <b>Кейс 1:</b>
                <span>
                  Дівчина, 30 років, зросту 165 см, вага 70 кг, середня активність, любить
                  солодке, алергій немає. <b>Ціль:</b> зниження ваги.
                </span>
              </div>
              <div className={styles.case}>
                <b>Кейс 2:</b>
                <span>
                  Чоловік, 40 років, зросту 180 см, вага 70 кг, висока фізична активність
                  (фізична робота + ~20 хв пішки в один бік), не любить борошняне.{" "}
                  <b>Ціль:</b> набір маси.
                </span>
              </div>
            </div>
          </section>
        </main>

        <footer className={styles.footer}>
          КАРТОТЕКА ТРЕНЕРА · зведений конспект відео-семінарів для внутрішнього використання
        </footer>
        </div>
      </div>
    </div>,
    document.body
  );
}
