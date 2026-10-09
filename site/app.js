// Seven Gym marketing site: content, 3 languages (RU / KZ / EN), lead form.
const API = 'https://gym.matai.kz/api/clients';
const IMG = (id, w = 1000) => `https://images.unsplash.com/photo-${id}?w=${w}&q=80`;

const clubs = [
  { id: 'c1', name: 'Seven Gym Akkent', city: 'city_alm', addr: 'Адрес уточняется', h: '07:00–23:00', area: 0, machines: 0, rating: '', phone: '+7 727 300 00 01', img: '1671970922029-0430d2ae122c', am: ['am_gym'] },
  { id: 'c2', name: 'Seven Gym Premier', city: 'city_alm', addr: 'Адрес уточняется', h: '07:00–23:00', area: 0, machines: 0, rating: '', phone: '+7 727 300 00 01', img: '1758448756350-3d0eec02ba37', am: ['am_gym'] },
];

const plans = [
  { n: 'pl_start', months: 1, price: 25000, per: 25000, f: [['ft_all'], ['ft_groups'], ['ft_freeze', 7]] },
  { n: 'pl_formula', months: 3, price: 60000, old: 75000, per: 20000, f: [['ft_all'], ['ft_groups'], ['ft_freeze', 14], ['ft_guest', 1]] },
  { n: 'pl_progress', months: 6, price: 105000, old: 150000, per: 17500, pop: true, f: [['ft_all'], ['ft_groups'], ['ft_freeze', 30], ['ft_guest', 3], ['ft_body']] },
  { n: 'pl_champ', months: 12, price: 180000, old: 300000, per: 15000, f: [['ft_all'], ['ft_groups'], ['ft_freeze', 90], ['ft_guest', 6], ['ft_body'], ['ft_pt', 2]] },
  { n: 'pl_day', months: 1, price: 15000, per: 15000, f: [['ft_day'], ['ft_all'], ['ft_daygroups']] },
];

const trainers = [
  { name: 'Айдар Сериков', sp: ['sp_strength', 'sp_crossfit', 'sp_mass'], rating: '4,9', exp: 8, price: 12000, pro: true },
  { name: 'Динара Ахметова', sp: ['sp_yoga', 'sp_pilates', 'sp_stretch'], rating: '5,0', exp: 10, price: 10000 },
  { name: 'Руслан Бекжанов', sp: ['sp_box', 'sp_kick', 'sp_func'], rating: '4,8', exp: 12, price: 11000, pro: true },
  { name: 'Алина Ким', sp: ['sp_loss', 'sp_cardio', 'sp_nutrition'], rating: '4,9', exp: 6, price: 10000, pro: true },
  { name: 'Ерлан Нурланов', sp: ['sp_swim', 'sp_aqua', 'sp_tri'], rating: '4,7', exp: 9, price: 9000 },
  { name: 'Мадина Оспанова', sp: ['sp_dance', 'sp_zumba', 'sp_cycle'], rating: '4,8', exp: 5, price: 8000 },
];

const dict = {
  ru: {
    nav_clubs: 'Клубы', nav_prices: 'Тарифы', nav_trainers: 'Тренеры', nav_app: 'Приложение', nav_faq: 'Вопросы', nav_login: 'Войти', nav_lead: 'Оставить заявку',
    hero_eyebrow: 'Алматы', hero_title: 'Сеть залов,<br />где всё <em>под рукой</em>', hero_sub: '2 клуба, QR-вход и ИИ-тренер в приложении. Начни с 3 бесплатных дней.', hero_cta1: '3 дня бесплатно', hero_cta2: 'Выбрать клуб',
    stat_clubs: 'клуба в Алматы', stat_machines: 'тренажёров', stat_247: 'в клубе на Достык', stat_rating: 'средняя оценка клиентов',
    mq1: 'QR-ВХОД', mq2: 'ИИ-ТРЕНЕР', mq3: 'ГРУППОВЫЕ ПРОГРАММЫ', mq4: 'ПЕРСОНАЛЬНЫЕ ТРЕНИРОВКИ', mq5: 'СПОРТПИТ', mq6: 'СПА И САУНА',
    clubs_eyebrow: 'Клубы', clubs_title: 'Выбери свой клуб', city_alm: 'Алматы', h247: 'Круглосуточно', club_area: 'м²', club_machines: 'тренажёров', club_pick: 'Записаться в этот клуб', club_call: 'Позвонить',
    am_gym: 'Тренажёрный зал', am_pool25: 'Бассейн 25 м', am_pool: 'Бассейн', am_sauna: 'Сауна', am_groups: 'Групповые залы', am_yoga: 'Йога-студия', am_cycle: 'Сайкл-студия', am_boxing: 'Бокс-зона', am_lockers: 'Сейфы в раздевалках', am_crossfit: 'Кроссфит-зона', am_parking: 'Парковка',
    why_eyebrow: 'Почему мы', why_title: 'Всё нужное — в одном приложении',
    why1_t: 'QR вместо карты', why1_p: 'Покажи код на входе. Абонемент, заморозка и продление всегда в телефоне.',
    why2_t: 'ИИ-тренер', why2_p: 'План под твой вес, рост и цель. Подскажет технику упражнения и питание.',
    why3_t: 'Группы и персональные', why3_p: 'Запись на занятие в два тапа. Тренеры с опытом, понятная цена за сессию.',
    why4_t: 'Магазин спортпита', why4_p: 'Протеин, добавки и аксессуары. Заказал в приложении, забрал в клубе со скидкой.',
    trial_eyebrow: 'Без обязательств', trial_title: '3 дня пробных тренировок', trial_p: 'Бесплатно, можно без тренера. Оставь заявку, администратор активирует пробный период, и QR появится в приложении.', trial_cta: 'Попробовать',
    price_eyebrow: 'Тарифы', price_title: 'Абонементы на любой срок', price_note: 'Оплата и выдача абонемента на ресепшене любого клуба. После оплаты QR-пропуск сразу появляется в приложении. Все клубы сети входят в абонемент.',
    pl_start: 'Старт', pl_formula: 'Формула', pl_progress: 'Прогресс', pl_champ: 'Чемпион', pl_day: 'Дневной', pl_pop: 'Популярный', per_mo: '{n} ₸ в месяц',
    ft_all: 'Все клубы сети', ft_groups: 'Групповые занятия', ft_freeze: 'Заморозка {n} дн.', ft_guest: 'Гостевых визитов: {n}', ft_body: 'Анализ состава тела', ft_pt: 'Персональных: {n}', ft_day: 'Вход с 07:00 до 17:00', ft_daygroups: 'Группы днём',
    tr_eyebrow: 'Тренеры', tr_title: 'Люди, с которыми получается', tr_exp: 'опыт {n} лет', tr_price: '{n} ₸ за занятие',
    sp_strength: 'Силовые', sp_crossfit: 'Кроссфит', sp_mass: 'Набор массы', sp_yoga: 'Йога', sp_pilates: 'Пилатес', sp_stretch: 'Растяжка', sp_box: 'Бокс', sp_kick: 'Кикбоксинг', sp_func: 'Функциональный', sp_loss: 'Похудение', sp_cardio: 'Кардио', sp_nutrition: 'Питание', sp_swim: 'Плавание', sp_aqua: 'Аква', sp_tri: 'Триатлон', sp_dance: 'Танцы', sp_zumba: 'Zumba', sp_cycle: 'Сайкл',
    app_eyebrow: 'Приложение', app_title: 'Приложение, которое подскажет и поддержит', app1: 'QR-пропуск и статус абонемента', app2: 'Запись на групповые занятия и к тренеру', app3: 'ИИ-тренер: план недели и техника упражнений', app4: 'Магазин спортпита с заказом в клуб', app5: 'Прогресс: вес, визиты, серии недель', app_cta: 'Открыть приложение',
    ph_plan: 'Абонемент «Прогресс»', ph_days: 'дней осталось', ph_in: 'Сейчас в зале', ph_next: 'Ближайшее занятие',
    faq_eyebrow: 'Вопросы', faq_title: 'Коротко о главном',
    q1: 'Как начать заниматься?', a1: 'Оставь заявку на сайте или приди в любой клуб. Администратор оформит абонемент или пробный период, а QR-пропуск появится в приложении.',
    q2: 'Можно ли ходить в любой клуб сети?', a2: 'Да, абонемент действует во всех трёх клубах. Дневной тариф ограничен временем до 17:00.',
    q3: 'Можно ли заморозить абонемент?', a3: 'Да. Дни заморозки зависят от тарифа: от 7 дней на «Старте» до 90 дней на «Чемпионе». Заморозку можно включить в приложении.',
    q4: 'Сколько можно находиться в зале?', a4: 'После входа по QR доступно 2 часа. Когда время выходит, выход отмечается автоматически, чтобы счётчик людей в зале был точным.',
    lead_eyebrow: 'Заявка', lead_title: 'Оставь контакты, мы перезвоним', lead_p: 'Расскажем про тарифы, подберём клуб и активируем 3 бесплатных дня.',
    f_name: 'Имя', f_phone: 'Телефон', f_club: 'Клуб', f_send: 'Отправить заявку', f_sending: 'Отправляем…', f_ok: 'Спасибо! Заявка принята, администратор свяжется с вами.', f_err: 'Не получилось отправить. Позвоните в клуб или напишите в WhatsApp.', f_bad: 'Проверьте имя и номер телефона.', f_any: 'Любой клуб',
    foot_p: 'Сеть фитнес-клубов в Алматы.', foot_contacts: 'Связаться', foot_app: 'Веб-версия приложения',
    months: (n) => (n === 1 ? 'месяц' : n < 5 ? 'месяца' : 'месяцев'),
  },
  kk: {
    nav_clubs: 'Клубтар', nav_prices: 'Тарифтер', nav_trainers: 'Жаттықтырушылар', nav_app: 'Қосымша', nav_faq: 'Сұрақтар', nav_login: 'Кіру', nav_lead: 'Өтінім қалдыру',
    hero_eyebrow: 'Алматы', hero_title: 'Бәрі <em>қолыңда</em><br />тұратын залдар желісі', hero_sub: '2 клуб, QR арқылы кіру және қосымшадағы ЖИ-жаттықтырушы. 3 тегін күннен бастаңыз.', hero_cta1: '3 күн тегін', hero_cta2: 'Клубты таңдау',
    stat_clubs: 'Алматыдағы клуб', stat_machines: 'жаттығу құралы', stat_247: 'Достық клубында', stat_rating: 'клиенттердің орташа бағасы',
    mq1: 'QR АРҚЫЛЫ КІРУ', mq2: 'ЖИ-ЖАТТЫҚТЫРУШЫ', mq3: 'ТОП БАҒДАРЛАМАЛАРЫ', mq4: 'ЖЕКЕ ЖАТТЫҒУЛАР', mq5: 'СПОРТ ТАМАҒЫ', mq6: 'СПА ЖӘНЕ САУНА',
    clubs_eyebrow: 'Клубтар', clubs_title: 'Өз клубыңызды таңдаңыз', city_alm: 'Алматы', h247: 'Тәулік бойы', club_area: 'м²', club_machines: 'жаттығу құралы', club_pick: 'Осы клубқа жазылу', club_call: 'Қоңырау шалу',
    am_gym: 'Жаттығу залы', am_pool25: '25 м бассейн', am_pool: 'Бассейн', am_sauna: 'Сауна', am_groups: 'Топтық залдар', am_yoga: 'Йога студиясы', am_cycle: 'Сайкл студиясы', am_boxing: 'Бокс аймағы', am_lockers: 'Киім ауыстыру бөлмесіндегі сейфтер', am_crossfit: 'Кроссфит аймағы', am_parking: 'Тұрақ',
    why_eyebrow: 'Неге біз', why_title: 'Қажеттінің бәрі бір қосымшада',
    why1_t: 'Карта орнына QR', why1_p: 'Кіреберісте кодты көрсетіңіз. Абонемент, мұздату және ұзарту әрдайым телефонда.',
    why2_t: 'ЖИ-жаттықтырушы', why2_p: 'Салмағыңыз, бойыңыз және мақсатыңызға сай жоспар. Жаттығу техникасы мен тамақтануды айтады.',
    why3_t: 'Топтық және жеке', why3_p: 'Сабаққа екі басумен жазылу. Тәжірибелі жаттықтырушылар, сабақтың түсінікті бағасы.',
    why4_t: 'Спорттық тамақ дүкені', why4_p: 'Протеин, қоспалар және аксессуарлар. Қосымшада тапсырыс беріп, клубтан жеңілдікпен алыңыз.',
    trial_eyebrow: 'Міндеттемесіз', trial_title: '3 күндік сынақ жаттығулары', trial_p: 'Тегін, жаттықтырушысыз да болады. Өтінім қалдырыңыз, әкімші сынақ мерзімін қосады және QR қосымшада пайда болады.', trial_cta: 'Байқап көру',
    price_eyebrow: 'Тарифтер', price_title: 'Кез келген мерзімге абонементтер', price_note: 'Абонементті кез келген клубтың ресепшенінде төлеп аласыз. Төлемнен кейін QR-рұқсат қосымшада бірден пайда болады. Желідегі барлық клуб абонементке кіреді.',
    pl_start: 'Бастау', pl_formula: 'Формула', pl_progress: 'Прогресс', pl_champ: 'Чемпион', pl_day: 'Күндізгі', pl_pop: 'Танымал', per_mo: 'айына {n} ₸',
    ft_all: 'Желінің барлық клубы', ft_groups: 'Топтық сабақтар', ft_freeze: '{n} күн мұздату', ft_guest: 'Қонақ келулері: {n}', ft_body: 'Дене құрамын талдау', ft_pt: 'Жеке жаттығу: {n}', ft_day: '07:00–17:00 кіру', ft_daygroups: 'Күндізгі топтар',
    tr_eyebrow: 'Жаттықтырушылар', tr_title: 'Нәтиже беретін адамдар', tr_exp: '{n} жыл тәжірибе', tr_price: 'сабағы {n} ₸',
    sp_strength: 'Күш', sp_crossfit: 'Кроссфит', sp_mass: 'Салмақ қосу', sp_yoga: 'Йога', sp_pilates: 'Пилатес', sp_stretch: 'Созылу', sp_box: 'Бокс', sp_kick: 'Кикбоксинг', sp_func: 'Функционалды', sp_loss: 'Арықтау', sp_cardio: 'Кардио', sp_nutrition: 'Тамақтану', sp_swim: 'Жүзу', sp_aqua: 'Аква', sp_tri: 'Триатлон', sp_dance: 'Би', sp_zumba: 'Zumba', sp_cycle: 'Сайкл',
    app_eyebrow: 'Қосымша', app_title: 'Айтып отыратын және қолдайтын қосымша', app1: 'QR-рұқсат және абонемент мәртебесі', app2: 'Топтық сабаққа және жаттықтырушыға жазылу', app3: 'ЖИ-жаттықтырушы: апта жоспары және жаттығу техникасы', app4: 'Клубқа тапсырыс беретін спорт тамағы дүкені', app5: 'Прогресс: салмақ, келулер, апта сериялары', app_cta: 'Қосымшаны ашу',
    ph_plan: '«Прогресс» абонементі', ph_days: 'күн қалды', ph_in: 'Қазір залда', ph_next: 'Жақын сабақ',
    faq_eyebrow: 'Сұрақтар', faq_title: 'Қысқаша басты мәселе',
    q1: 'Жаттығуды қалай бастауға болады?', a1: 'Сайтта өтінім қалдырыңыз немесе кез келген клубқа келіңіз. Әкімші абонемент немесе сынақ мерзімін рәсімдейді, ал QR қосымшада пайда болады.',
    q2: 'Желінің кез келген клубына бара аламын ба?', a2: 'Иә, абонемент барлық үш клубта жарамды. Күндізгі тариф 17:00-ге дейін шектелген.',
    q3: 'Абонементті мұздатуға бола ма?', a3: 'Иә. Мұздату күндері тарифке байланысты: «Бастауда» 7 күннен «Чемпионда» 90 күнге дейін. Мұздатуды қосымшадан қосуға болады.',
    q4: 'Залда қанша уақыт болуға болады?', a4: 'QR арқылы кіргеннен кейін 2 сағат беріледі. Уақыт біткенде шығу өзі белгіленеді, сондықтан залдағы адам саны дәл болады.',
    lead_eyebrow: 'Өтінім', lead_title: 'Байланысыңызды қалдырыңыз, қоңырау шаламыз', lead_p: 'Тарифтер туралы айтамыз, клубты таңдаймыз және 3 тегін күнді қосамыз.',
    f_name: 'Аты', f_phone: 'Телефон', f_club: 'Клуб', f_send: 'Өтінім жіберу', f_sending: 'Жіберілуде…', f_ok: 'Рахмет! Өтінім қабылданды, әкімші сізбен байланысады.', f_err: 'Жіберу мүмкін болмады. Клубқа қоңырау шалыңыз немесе WhatsApp-қа жазыңыз.', f_bad: 'Аты мен телефон нөмірін тексеріңіз.', f_any: 'Кез келген клуб',
    foot_p: 'Алматыдағы фитнес-клубтар желісі.', foot_contacts: 'Байланыс', foot_app: 'Қосымшаның веб-нұсқасы',
    months: () => 'ай',
  },
  en: {
    nav_clubs: 'Clubs', nav_prices: 'Prices', nav_trainers: 'Trainers', nav_app: 'App', nav_faq: 'FAQ', nav_login: 'Log in', nav_lead: 'Request a call',
    hero_eyebrow: 'Almaty', hero_title: 'The gym network<br />where everything is <em>at hand</em>', hero_sub: '2 clubs, QR entry and an AI coach in the app. Start with 3 free days.', hero_cta1: '3 days free', hero_cta2: 'Choose a club',
    stat_clubs: 'clubs in Almaty', stat_machines: 'machines', stat_247: 'at the Dostyk club', stat_rating: 'average client rating',
    mq1: 'QR ENTRY', mq2: 'AI COACH', mq3: 'GROUP CLASSES', mq4: 'PERSONAL TRAINING', mq5: 'SPORTS NUTRITION', mq6: 'SPA AND SAUNA',
    clubs_eyebrow: 'Clubs', clubs_title: 'Pick your club', city_alm: 'Almaty', h247: 'Open 24/7', club_area: 'm²', club_machines: 'machines', club_pick: 'Join this club', club_call: 'Call',
    am_gym: 'Gym floor', am_pool25: '25 m pool', am_pool: 'Pool', am_sauna: 'Sauna', am_groups: 'Group studios', am_yoga: 'Yoga studio', am_cycle: 'Cycle studio', am_boxing: 'Boxing zone', am_lockers: 'Locker-room safes', am_crossfit: 'CrossFit zone', am_parking: 'Parking',
    why_eyebrow: 'Why us', why_title: 'Everything you need in one app',
    why1_t: 'QR instead of a card', why1_p: 'Show the code at the door. Your plan, freeze and renewal are always on your phone.',
    why2_t: 'AI coach', why2_p: 'A plan built on your weight, height and goal. It explains exercise technique and nutrition.',
    why3_t: 'Group and personal', why3_p: 'Book a class in two taps. Experienced trainers and a clear price per session.',
    why4_t: 'Sports nutrition shop', why4_p: 'Protein, supplements and accessories. Order in the app, pick up at the club with a discount.',
    trial_eyebrow: 'No commitment', trial_title: '3 days of free trial training', trial_p: 'Free, and you can come without a trainer. Leave a request, the administrator activates the trial and your QR appears in the app.', trial_cta: 'Try it',
    price_eyebrow: 'Prices', price_title: 'Memberships for any length', price_note: 'You pay and receive the membership at the front desk of any club. Right after payment the QR pass appears in the app. All clubs of the network are included.',
    pl_start: 'Start', pl_formula: 'Formula', pl_progress: 'Progress', pl_champ: 'Champion', pl_day: 'Daytime', pl_pop: 'Popular', per_mo: '{n} ₸ per month',
    ft_all: 'All clubs of the network', ft_groups: 'Group classes', ft_freeze: '{n} days of freeze', ft_guest: 'Guest visits: {n}', ft_body: 'Body composition analysis', ft_pt: 'Personal sessions: {n}', ft_day: 'Entry 07:00 to 17:00', ft_daygroups: 'Daytime classes',
    tr_eyebrow: 'Trainers', tr_title: 'People who get results', tr_exp: '{n} yrs experience', tr_price: '{n} ₸ per session',
    sp_strength: 'Strength', sp_crossfit: 'CrossFit', sp_mass: 'Muscle gain', sp_yoga: 'Yoga', sp_pilates: 'Pilates', sp_stretch: 'Stretching', sp_box: 'Boxing', sp_kick: 'Kickboxing', sp_func: 'Functional', sp_loss: 'Weight loss', sp_cardio: 'Cardio', sp_nutrition: 'Nutrition', sp_swim: 'Swimming', sp_aqua: 'Aqua', sp_tri: 'Triathlon', sp_dance: 'Dance', sp_zumba: 'Zumba', sp_cycle: 'Cycle',
    app_eyebrow: 'App', app_title: 'The app that guides and supports you', app1: 'QR pass and membership status', app2: 'Book classes and trainers', app3: 'AI coach: weekly plan and exercise technique', app4: 'Sports nutrition shop with club pickup', app5: 'Progress: weight, visits, weekly streaks', app_cta: 'Open the app',
    ph_plan: '“Progress” membership', ph_days: 'days left', ph_in: 'In the gym now', ph_next: 'Next class',
    faq_eyebrow: 'FAQ', faq_title: 'The short version',
    q1: 'How do I get started?', a1: 'Leave a request on the site or visit any club. The administrator sets up a membership or a trial, and your QR pass appears in the app.',
    q2: 'Can I train at any club of the network?', a2: 'Yes, a membership works in all three clubs. The daytime plan is limited to before 17:00.',
    q3: 'Can I freeze my membership?', a3: 'Yes. Freeze days depend on the plan: from 7 days on Start to 90 days on Champion. You can switch the freeze on in the app.',
    q4: 'How long can I stay in the gym?', a4: 'After a QR entry you have 2 hours. When time runs out the exit is marked automatically, so the live headcount stays accurate.',
    lead_eyebrow: 'Request', lead_title: 'Leave your details and we will call', lead_p: 'We will explain the plans, pick a club and activate 3 free days.',
    f_name: 'Name', f_phone: 'Phone', f_club: 'Club', f_send: 'Send request', f_sending: 'Sending…', f_ok: 'Thank you! Your request is in, the administrator will contact you.', f_err: 'Could not send. Please call the club or message us on WhatsApp.', f_bad: 'Please check your name and phone number.', f_any: 'Any club',
    foot_p: 'A network of fitness clubs in Almaty.', foot_contacts: 'Contact', foot_app: 'Web version of the app',
    months: (n) => (n === 1 ? 'month' : 'months'),
  },
};

let lang = 'ru';
try { lang = localStorage.getItem('gp-lang') || (navigator.language || '').slice(0, 2); } catch (e) {}
if (!dict[lang]) lang = lang === 'kz' ? 'kk' : 'ru';

const t = (k, v) => String(dict[lang][k] ?? dict.ru[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => (v && v[n] != null ? v[n] : ''));
const money = (n) => n.toLocaleString('ru-RU').replace(/,/g, ' ');
const initials = (name) => name.split(' ').map((w) => w[0]).join('').slice(0, 2);
const $ = (s, r = document) => r.querySelector(s);

function render() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  document.querySelectorAll('[data-i18n-html]').forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
  document.querySelectorAll('#lang button').forEach((b) => b.classList.toggle('on', b.dataset.lang === lang));

  $('#clubGrid').innerHTML = clubs.map((c) => `
    <article class="club reveal" style="background-image:url('${IMG(c.img)}')">
      <div class="tags">${c.rating ? `<span class="tag gold">★ ${c.rating}</span>` : ''}${c.am.map((a) => `<span class="tag">${t(a)}</span>`).join('')}</div>
      <h3>${c.name}</h3>
      <p class="addr">${t(c.city)}, ${c.addr}</p>
      <p class="meta"><span><b>${c.h === 'h247' ? t('h247') : c.h}</b></span>${c.area ? `<span><b>${money(c.area)}</b> ${t('club_area')}</span>` : ''}${c.machines ? `<span><b>${c.machines}+</b> ${t('club_machines')}</span>` : ''}</p>
      <div class="cta" style="margin-top:18px"><a class="btn btn-main" href="#lead" data-club="${c.id}">${t('club_pick')}</a><a class="btn btn-ghost" href="tel:${c.phone.replace(/\s/g, '')}">${t('club_call')}</a></div>
    </article>`).join('');

  $('#priceGrid').innerHTML = plans.map((p) => `
    <article class="price reveal${p.pop ? ' pop' : ''}">
      ${p.pop ? `<span class="badge">${t('pl_pop')}</span>` : ''}
      <span class="term">${p.months} ${dict[lang].months(p.months)}</span>
      <h3>${t(p.n)}</h3>
      <span class="sum">${money(p.price)} ₸</span>
      ${p.old ? `<span class="old">${money(p.old)} ₸</span>` : ''}
      <span class="per">${t('per_mo', { n: money(p.per) })}</span>
      <ul>${p.f.map(([k, n]) => `<li>${t(k, { n })}</li>`).join('')}</ul>
    </article>`).join('');

  $('#trainerGrid').innerHTML = trainers.map((r) => `
    <article class="trainer reveal">
      <div class="ava">${initials(r.name)}</div>
      <div>
        <h3>${r.name}${r.pro ? '<span class="pro">PRO</span>' : ''}</h3>
        <p class="sp">${r.sp.map((s) => t(s)).join(' • ')}</p>
        <p class="st"><span><b>★ ${r.rating}</b></span><span>${t('tr_exp', { n: r.exp })}</span><span>${t('tr_price', { n: money(r.price) })}</span></p>
      </div>
    </article>`).join('');

  const sel = $('#clubSelect');
  const keep = sel.value;
  sel.innerHTML = `<option value="">${t('f_any')}</option>` + clubs.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
  sel.value = keep;

  $('#footClubs').innerHTML = `<h4>${t('nav_clubs')}</h4>` + clubs.map((c) => `<p>${c.name}<br><a href="tel:${c.phone.replace(/\s/g, '')}">${c.phone}</a></p>`).join('');
  observe();
}

// reveal on scroll
let io;
function observe() {
  if (!('IntersectionObserver' in window)) return document.querySelectorAll('.reveal').forEach((e) => e.classList.add('in'));
  io = io || new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add('in'), io.unobserve(e.target))), { threshold: 0.12 });
  document.querySelectorAll('.reveal:not(.in)').forEach((e) => io.observe(e));
}

// language switch, mobile menu, club shortcut
$('#lang').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  lang = b.dataset.lang;
  try { localStorage.setItem('gp-lang', lang); } catch (err) {}
  render();
});
$('#burger').addEventListener('click', () => $('#nav').classList.toggle('open'));
$('#links').addEventListener('click', () => $('#nav').classList.remove('open'));
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-club]');
  if (a) $('#clubSelect').value = a.dataset.club;
});

// lead form
$('#leadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const msg = $('#formMsg');
  const name = f.name.value.trim();
  const phone = f.phone.value.trim();
  if (name.length < 2 || phone.replace(/\D/g, '').length < 10) {
    msg.className = 'form-msg err';
    msg.textContent = t('f_bad');
    return;
  }
  const btn = f.querySelector('button[type=submit]');
  btn.disabled = true;
  msg.className = 'form-msg';
  msg.textContent = t('f_sending');
  try {
    const res = await fetch(`${API}?op=lead`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, phone, clubId: f.club.value, lang }) });
    if (!res.ok) throw new Error('bad');
    msg.className = 'form-msg ok';
    msg.textContent = t('f_ok');
    f.reset();
  } catch (err) {
    msg.className = 'form-msg err';
    msg.textContent = t('f_err');
  }
  btn.disabled = false;
});

render();
