import type { Messages } from './en';
import type { OrderStatus } from '../types/store';

const plural = (count: number, one: string, other: string) => `${count} ${count === 1 ? one : other}`;

// How a status reads after "ist bereits" or "als ... markieren"
const STATUS_WORDS: Record<OrderStatus, string> = {
  processing: 'in Bearbeitung',
  shipped: 'versandt',
  delivered: 'zugestellt',
  cancelled: 'storniert'
};

const inCartNote = (inCart: number | undefined) => (inCart ? ` Du hast schon ${inCart} im Warenkorb.` : '');

export const de: Messages = {
  common: {
    tryAgain: 'Erneut versuchen',
    browseProducts: 'Produkte ansehen',
    logIn: 'Anmelden',
    cancel: 'Abbrechen',
    delete: 'Löschen',
    edit: 'Bearbeiten',
    keep: 'Behalten',
    saveChanges: 'Änderungen speichern',
    apply: 'Anwenden',
    remove: 'Entfernen',
    close: 'Schließen',
    addToCart: 'In den Korb',
    email: 'E-Mail',
    password: 'Passwort',
    quantity: 'Menge:',
    noLongerAvailable: 'Nicht mehr erhältlich',
    viewAllOrders: 'Alle Bestellungen'
  },
  app: {
    pageLoadFailed: 'Prüfe deine Verbindung und versuche es erneut.',
    changeNotSaved: 'Deine Änderung wurde nicht gespeichert. Der Demo-Server startet vielleicht gerade, versuche es bitte noch einmal.',
    footerNote: 'Demo-Shop, die Daten werden regelmäßig zurückgesetzt. Keine echten Bestellungen oder Zahlungen.',
    footerLink: 'Code auf GitHub ansehen'
  },
  pageStatus: {
    loading: 'Wird geladen …',
    slow: 'Der Demo-Server startet gerade. Das kann bis zu einer Minute dauern.',
    errorTitle: 'Diese Seite konnte nicht geladen werden',
    errorDetail: 'Der Demo-Server startet vielleicht gerade. Versuche es gleich noch einmal.'
  },
  header: {
    logo: (store) => `${store} Startseite`,
    search: 'Produkte suchen',
    searchButton: 'Suchen',
    admin: 'Admin',
    orders: 'Bestellungen',
    account: 'Konto',
    accountLabel: (email) => `Dein Konto, ${email}`,
    cart: 'Warenkorb',
    cartLabel: (count) => `Warenkorb, ${plural(count, 'Artikel', 'Artikel')}`,
    language: 'Sprache',
    darkMode: 'Dunkler Modus'
  },
  toasts: {
    notifications: 'Benachrichtigungen',
    errors: 'Fehler'
  },
  rating: {
    stars: (stars) => `${stars} von 5 Sternen`
  },
  stock: {
    outOfStock: 'Ausverkauft',
    onlyLeft: (stock) => `Nur noch ${stock} da`,
    inStock: (stock) => `${stock} auf Lager`
  },
  addToCart: {
    quantityLabel: (name) => `Menge von ${name}`,
    added: (name, quantity) => `${quantity > 1 ? `${quantity} × ` : ''}${name} liegt jetzt im Warenkorb`,
    viewCart: 'Zum Warenkorb'
  },
  categories: {
    'Home & Kitchen': 'Haushalt & Küche',
    Clothing: 'Kleidung',
    Shoes: 'Schuhe',
    Accessories: 'Accessoires',
    Sports: 'Sport'
  },
  home: {
    title: 'Alltägliches, direkt geliefert',
    intro: 'Basics für Zuhause, Küche und Kleiderschrank, mit kostenlosem Versand für jede Bestellung.',
    resultsFor: (search) => `Ergebnisse für „${search}“`,
    noResults: (search) => `Keine Produkte für „${search}“ gefunden`,
    noMatch: 'Keine Produkte passen zu diesen Filtern',
    noProducts: 'Keine Produkte verfügbar',
    categories: 'Kategorien',
    allCategories: 'Alle',
    productCount: (count) => plural(count, 'Produkt', 'Produkte'),
    clearFilters: 'Filter zurücksetzen',
    price: 'Preis',
    minPrice: 'Mindestpreis in Dollar',
    maxPrice: 'Höchstpreis in Dollar',
    min: 'Min.',
    max: 'Max.',
    priceTo: 'bis',
    sortBy: 'Sortieren nach',
    sorts: {
      '': 'Empfohlen',
      'price-asc': 'Preis: aufsteigend',
      'price-desc': 'Preis: absteigend',
      rating: 'Kundenbewertung',
      newest: 'Neueste'
    }
  },
  product: {
    title: 'Produkt',
    notFound: 'Dieses Produkt wurde nicht gefunden',
    related: 'Das könnte dir auch gefallen',
    recentlyViewed: 'Zuletzt angesehen'
  },
  reviews: {
    title: 'Kundenbewertungen',
    loadFailed: 'Die Bewertungen konnten nicht geladen werden',
    loading: 'Bewertungen werden geladen …',
    orderedOnly: 'Nur wer dieses Produkt bestellt hat, kann es bewerten.',
    logInLink: 'Melde dich an',
    logInRest: ', um eine Bewertung zu schreiben. ',
    none: 'Noch keine geschriebenen Bewertungen.',
    verified: 'Verifizierter Kauf',
    you: ' (du)',
    deleteQuestion: 'Diese Bewertung löschen?',
    deleted: 'Bewertung gelöscht',
    updated: 'Bewertung aktualisiert',
    posted: 'Danke! Deine Bewertung ist online',
    editTitle: 'Bewertung bearbeiten',
    writeTitle: 'Bewertung schreiben',
    rating: 'Bewertung',
    starChoice: (stars) => plural(stars, 'Stern', 'Sterne'),
    text: 'Text (optional)',
    characters: (count, max) => `${count}/${max} Zeichen`,
    post: 'Bewertung veröffentlichen'
  },
  checkout: {
    title: 'Kasse',
    itemCount: (count) => plural(count, 'Artikel', 'Artikel'),
    secure: 'Sichere Kasse',
    heading: 'Bestellung prüfen',
    empty: 'Dein Warenkorb ist leer',
    deliveryDate: (date) => `Lieferdatum: ${date}`,
    chooseDelivery: 'Versandart wählen:',
    shipping: (price) => `${price} Versand`,
    freeShipping: 'KOSTENLOSER Versand',
    quantityUpdated: 'Menge aktualisiert',
    update: 'Ändern',
    newQuantity: 'Neue Menge',
    removed: (name) => `${name} aus dem Warenkorb entfernt`,
    paymentSummary: 'Zahlungsübersicht',
    items: (count) => `Artikel (${count}):`,
    discount: (code) => `Rabatt (${code}):`,
    shippingHandling: 'Versand & Bearbeitung:',
    totalBeforeTax: 'Summe vor Steuern:',
    tax: 'Geschätzte Steuer (10 %):',
    orderTotal: 'Gesamtbetrag:',
    payWithCard: 'Mit Karte bezahlen',
    testMode: 'Testmodus:',
    testCard: 'Nutze die Karte 4242 4242 4242 4242 mit einem beliebigen künftigen Datum und beliebiger Prüfnummer. Es wird nichts abgebucht.',
    payOnDelivery: 'Bei Lieferung bezahlen',
    placeOrder: 'Jetzt bestellen',
    orderPlaced: 'Bestellung aufgegeben. Vielen Dank!',
    couponExpired: (code) => `Der Gutschein ${code} kann nicht mehr verwendet werden.`
  },
  coupon: {
    label: 'Gutscheincode',
    applied: (code) => `Gutschein ${code} eingelöst`,
    appliedRest: (percentOff) => ` eingelöst: ${percentOff} % Rabatt auf deine Artikel`,
    removeLabel: (code) => `Gutschein ${code} entfernen`,
    removed: 'Gutschein entfernt',
    checkFailed: 'Der Code konnte nicht geprüft werden. Versuche es bitte erneut.',
    hintStart: 'Mit ',
    hintRest: (percentOff) => ` sparst du ${percentOff} % auf deine Artikel.`
  },
  checkoutSuccess: {
    title: 'Zahlung wird bestätigt',
    heading: 'Deine Zahlung wird bestätigt',
    unpaidTitle: 'Deine Zahlung ist nicht durchgegangen',
    unpaidDetail: 'Dein Warenkorb ist unverändert, du kannst es also erneut versuchen.',
    backToCheckout: 'Zurück zur Kasse',
    failedTitle: 'Deine Zahlung konnte nicht bestätigt werden',
    failedDetail: 'Wenn du bezahlt hast, erscheint deine Bestellung gleich bei deinen Bestellungen.'
  },
  orders: {
    title: 'Deine Bestellungen',
    none: 'Du hast noch nichts bestellt',
    placed: 'Bestellt am',
    total: 'Summe',
    payment: 'Zahlung',
    paidByCard: 'Mit Karte bezahlt',
    payOnDelivery: 'Zahlung bei Lieferung',
    status: 'Status',
    orderId: 'Bestellnummer',
    arriving: (date) => `Lieferung am ${date}`,
    trackPackage: 'Sendung verfolgen',
    cancelQuestion: 'Diese Bestellung stornieren?',
    cancelAndRefundQuestion: 'Diese Bestellung stornieren und die Zahlung erstatten?',
    cancelled: 'Bestellung storniert. Die Artikel sind wieder auf Lager',
    cancelledAndRefunded: 'Bestellung storniert und deine Zahlung erstattet',
    cancelOrder: 'Bestellung stornieren',
    keepOrder: 'Bestellung behalten',
    cancelHint: 'Stornieren ist bis zum Versand möglich'
  },
  orderStatus: {
    processing: 'In Bearbeitung',
    shipped: 'Versandt',
    delivered: 'Zugestellt',
    cancelled: 'Storniert',
    refunded: 'Erstattet'
  },
  paymentMethods: {
    card: 'Karte',
    delivery: 'Bei Lieferung'
  },
  tracking: {
    title: 'Sendung verfolgen',
    progress: 'Lieferfortschritt',
    cancelled: 'Diese Bestellung wurde vor dem Versand storniert, das Paket wird also nicht zugestellt.',
    refunded: ' Die Zahlung wurde erstattet.',
    notFound: 'Dieses Paket wurde nicht gefunden'
  },
  wishlist: {
    title: 'Deine Merkliste',
    link: 'Merkliste',
    save: (name) => `${name} merken`,
    saved: (name) => `${name} ist jetzt auf deiner Merkliste`,
    removed: (name) => `${name} von der Merkliste entfernt`,
    view: 'Zur Merkliste',
    logInHint: 'Melde dich an, um dir Produkte zu merken',
    logInPrompt: 'Melde dich an, um deine Merkliste zu sehen',
    empty: 'Deine Merkliste ist leer',
    emptyText: 'Tippe bei einem Produkt auf das Herz, um es dir für später zu merken.',
    linkText: 'Produkte, die du dir für später gemerkt hast'
  },
  account: {
    title: 'Dein Konto',
    loginDetails: 'Anmeldedaten',
    customerSince: 'Kunde seit',
    ordersTitle: 'Deine Bestellungen',
    ordersText: 'Sendungen verfolgen, erneut kaufen oder Gekauftes bewerten',
    passwordTitle: 'Passwort ändern',
    passwordText: 'Ein neues Passwort für dieses Konto wählen',
    manageTitle: 'Shop verwalten',
    manageText: 'Produkte, Bestand und Gutscheine',
    logOut: 'Abmelden',
    loggedOut: 'Du bist abgemeldet',
    logInPrompt: 'Melde dich an, um dein Konto zu sehen'
  },
  login: {
    signUpTitle: 'Konto erstellen',
    checkEmail: 'Schau in dein Postfach',
    confirmationStart: 'Wir haben einen Link an ',
    confirmationRest: ' geschickt. Öffne ihn, um dein Konto zu bestätigen und dich anzumelden.',
    intro: 'Warenkorb und Bestellungen werden in deinem Konto gespeichert und sind so auf jedem Gerät da.',
    forgot: 'Passwort vergessen?',
    signUp: 'Registrieren',
    haveAccount: 'Schon ein Konto?',
    newHere: 'Neu hier?',
    createAccount: 'Konto erstellen',
    unreachable: 'Der Anmeldedienst ist nicht erreichbar. Prüfe deine Verbindung und versuche es erneut.'
  },
  forgotPassword: {
    title: 'Passwort zurücksetzen',
    sentStart: 'Falls es für ',
    sentRest: ' ein Konto gibt, haben wir einen Link für ein neues Passwort geschickt. Der Link funktioniert einmal und ist eine Stunde gültig.',
    backToLogIn: 'Zurück zur Anmeldung',
    intro: 'Gib die E-Mail-Adresse ein, mit der du dich anmeldest. Wir schicken dir einen Link für ein neues Passwort.',
    send: 'Link senden',
    remembered: 'Doch wieder eingefallen?'
  },
  resetPassword: {
    title: 'Neues Passwort wählen',
    forStart: 'Für ',
    forRest: '. Du bleibst auf diesem Gerät angemeldet.',
    newPassword: 'Neues Passwort',
    repeat: 'Neues Passwort wiederholen',
    save: 'Passwort speichern',
    mismatch: 'Die Passwörter stimmen nicht überein.',
    changed: 'Dein Passwort wurde geändert',
    expiredTitle: 'Dieser Link ist abgelaufen',
    expiredText: 'Ein Link zum Zurücksetzen funktioniert einmal und ist eine Stunde gültig. Fordere einen neuen an und öffne ihn in diesem Browser.',
    sendNew: 'Neuen Link senden'
  },
  authErrors: {
    invalid_credentials: 'E-Mail oder Passwort ist falsch.',
    email_not_confirmed: 'Bestätige zuerst deine E-Mail-Adresse über den Link, den wir dir geschickt haben.',
    user_already_exists: 'Für diese E-Mail-Adresse gibt es schon ein Konto.',
    weak_password: 'Wähle ein sichereres Passwort.',
    same_password: 'Das neue Passwort muss sich vom alten unterscheiden.',
    email_address_invalid: 'Diese E-Mail-Adresse ist ungültig.',
    over_email_send_rate_limit: 'Es wurden zu viele E-Mails verschickt. Warte ein paar Minuten und versuche es erneut.',
    over_request_rate_limit: 'Zu viele Versuche. Warte ein paar Minuten und versuche es erneut.'
  },
  notFound: {
    title: 'Seite nicht gefunden',
    text: 'Die gesuchte Seite gibt es nicht oder sie ist umgezogen.'
  },
  admin: {
    title: 'Admin',
    nav: 'Admin',
    overview: 'Übersicht',
    orders: 'Bestellungen',
    logInPrompt: 'Melde dich mit einem Admin-Konto an, um den Shop zu verwalten',
    forbidden: 'Diese Seite ist nur für Admins',
    stats: {
      title: 'Shop-Übersicht',
      ordersDay: 'Bestellungen, letzte 24 Stunden',
      ordersWeek: 'Bestellungen, letzte 7 Tage',
      revenueWeek: 'Umsatz, letzte 7 Tage',
      lowStock: 'Geringer Bestand',
      allStocked: (lowStock) => `Von jedem Produkt sind mehr als ${lowStock} auf Lager`,
      topProducts: 'Bestseller',
      sold: (units) => `${units} verkauft`,
      noSales: 'Noch keine Verkäufe',
      seeAll: 'Alle Bestellungen ansehen',
      hintRest: '. Stornierte Bestellungen zählen nicht zu Umsatz und Verkäufen.'
    },
    products: {
      title: 'Produkte',
      add: 'Produkt hinzufügen',
      caption: (count) => `${plural(count, 'Produkt', 'Produkte')} im Shop`,
      image: 'Bild',
      name: 'Name',
      price: 'Preis',
      stock: 'Bestand',
      category: 'Kategorie',
      keywords: 'Suchbegriffe',
      actions: 'Aktionen',
      editLabel: (name) => `${name} bearbeiten`,
      deleteLabel: (name) => `${name} löschen`,
      deleteGroup: (name) => `${name} löschen?`,
      deleteQuestion: 'Aus dem Shop löschen?',
      deleted: (name) => `${name} wurde aus dem Shop gelöscht`,
      editTitle: 'Produkt bearbeiten',
      addTitle: 'Produkt hinzufügen',
      priceInDollars: 'Preis ($)',
      chooseCategory: 'Kategorie wählen',
      keywordsHint: 'Durch Kommas getrennt, bis zu 10. Die Suche findet Produkte über diese Wörter.',
      saved: (name) => `${name} gespeichert`,
      added: (name) => `${name} wurde zum Shop hinzugefügt`
    },
    coupons: {
      title: 'Gutscheine',
      add: 'Gutschein hinzufügen',
      caption: (count) => `${plural(count, 'Gutschein', 'Gutscheine')}. Kunden geben den Code an der Kasse ein`,
      code: 'Code',
      discount: 'Rabatt',
      expires: 'Gültig bis',
      status: 'Status',
      percentOff: (percentOff) => `${percentOff} % Rabatt`,
      never: 'Unbegrenzt',
      off: 'Aus',
      expired: 'Abgelaufen',
      active: 'Aktiv',
      featured: 'Empfohlen',
      editLabel: (code) => `${code} bearbeiten`,
      editTitle: 'Gutschein bearbeiten',
      addTitle: 'Gutschein hinzufügen',
      codeHint: '3 bis 20 Buchstaben oder Ziffern',
      percentOffLabel: 'Rabatt in Prozent',
      expiresAfter: 'Gültig bis einschließlich',
      noEndDate: 'Leer lassen für unbegrenzt',
      activeLabel: 'Aktiv, Kunden können ihn einlösen',
      featuredLabel: 'Empfohlen, die Kasse schlägt ihn vor',
      featuredHint: 'Die Kasse zeigt den neuesten empfohlenen Gutschein, der aktiv und nicht abgelaufen ist.',
      saved: (code) => `Gutschein ${code} gespeichert`
    },
    orderList: {
      filters: 'Bestellungen filtern',
      status: 'Status',
      allStatuses: 'Alle Status',
      payment: 'Zahlung',
      allPayments: 'Alle Zahlungsarten',
      count: (shown, total) => (
        shown < total
          ? `Die neuesten ${shown} von ${plural(total, 'Bestellung', 'Bestellungen')}`
          : plural(total, 'Bestellung', 'Bestellungen')
      ),
      order: 'Bestellung',
      customer: 'Kunde',
      items: 'Artikel',
      total: 'Summe',
      noMatch: 'Keine Bestellungen passen zu diesen Filtern',
      none: 'Noch keine Bestellungen',
      changed: (id, status) => `Bestellung ${id}: ${status}`,
      markShipped: 'Als versandt markieren',
      markDelivered: 'Als zugestellt markieren',
      markLabel: (id, status) => `Bestellung ${id} als ${STATUS_WORDS[status]} markieren`,
      cancelGroup: (id) => `Bestellung ${id} stornieren?`,
      cancelLabel: (id) => `Bestellung ${id} stornieren`,
      refundQuestion: 'Erstatten und zurück ins Lager?',
      cancelQuestion: 'Stornieren und zurück ins Lager?'
    }
  },
  apiErrors: {
    outOfStock: ({ product, inCart }) => `${product} ist ausverkauft.${inCartNote(inCart)}`,
    lowStock: ({ product, stock, inCart }) => `Von ${product} sind nur noch ${stock} da.${inCartNote(inCart)}`,
    outOfStockInOrder: ({ product }) => `${product} ist ausverkauft. Entferne es aus dem Warenkorb, um fortzufahren.`,
    lowStockInOrder: ({ product, stock }) => (
      `Von ${product} sind nur noch ${stock} da. Verringere die Menge im Warenkorb, um fortzufahren.`
    ),
    emptyCart: () => 'Dein Warenkorb ist leer.',
    orderLimit: ({ max }) => `Dieser Demo-Shop speichert bis zu ${max} Bestellungen pro Besucher, und du hast das Limit erreicht.`,
    invalidCoupon: ({ code }) => (code ? `${code} ist kein gültiger Gutscheincode.` : 'Das ist kein gültiger Gutscheincode.'),
    expiredCoupon: ({ code }) => `Der Gutschein ${code} ist abgelaufen.`,
    couponTaken: ({ code }) => `Es gibt schon einen Gutschein mit dem Code ${code}`,
    reviewNotAllowed: () => 'Nur wer dieses Produkt bestellt hat, kann es bewerten.',
    alreadyReviewed: () => 'Du hast dieses Produkt schon bewertet. Bearbeite stattdessen deine Bewertung.',
    orderFinal: ({ status }) => `Diese Bestellung ist bereits ${status && STATUS_WORDS[status]}.`,
    statusNotAllowed: ({ status, nextStatus }) => (
      `Eine Bestellung, die ${status && STATUS_WORDS[status]} ist, kann nicht als ${nextStatus && STATUS_WORDS[nextStatus]} markiert werden.`
    ),
    orderChanged: () => 'Diese Bestellung wurde inzwischen geändert. Lade die Seite neu, um sie zu sehen.',
    refundUnavailable: () => 'Kartenzahlungen können gerade nicht erstattet werden, daher lässt sich diese Bestellung nicht stornieren.',
    refundNotAllowed: () => 'Die Zahlung dieser Bestellung kann der Shop nicht erstatten.',
    refundFailed: () => 'Die Erstattung ist fehlgeschlagen, daher wurde die Bestellung nicht storniert. Versuche es später erneut.',
    tooManyRequests: () => 'Zu viele Anfragen. Warte ein paar Minuten und versuche es erneut.'
  },
  validation: {
    valueMissing: 'Bitte fülle dieses Feld aus.',
    typeMismatch: 'Bitte gib eine gültige E-Mail-Adresse ein.',
    tooShort: (minLength) => `Bitte verwende mindestens ${minLength} Zeichen.`,
    rangeUnderflow: (min) => `Bitte gib ${min} oder mehr ein.`,
    rangeOverflow: (max) => `Bitte gib höchstens ${max} ein.`,
    stepMismatch: 'Bitte gib einen gültigen Wert ein.',
    badInput: 'Bitte gib eine Zahl ein.',
    patternMismatch: 'Bitte halte dich an das verlangte Format.'
  }
};
