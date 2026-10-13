# EDF Zen Week-End

Gladys berechnet die Kosten deines Stroms aus deinem Zähler und deinem Vertrag. Diese Integration fügt dem
Vertragsassistenten von Gladys die Verträge **EDF Zen Week-End** und **Zen Week-End Plus** hinzu
(Marktangebote von EDF in Frankreich), damit jede Kilowattstunde zum richtigen Preis zählt:

- das **ganze Wochenende** zum günstigeren Preis, von Samstag 0:00 bis Sonntag 24:00;
- die **landesweiten Feiertage** zum günstigeren Preis, von der Integration offline berechnet;
- deine **Enedis-Nebenzeiten** an den übrigen Tagen, mit den Nebenzeit-Optionen (8 Stunden pro Tag, die
  auf deiner Rechnung);
- der **gewählte Tag** (Montag, Mittwoch oder Freitag) des Angebots Plus;
- die **monatliche Grundgebühr** deiner Anschlussleistung.

Außerdem bringt sie **Szenenauslöser** genau zu der Minute, in der der günstigere Preis beginnt oder endet
(um den Warmwasserspeicher oder das Laden des Autos zu starten), eine **Szenenaktion**, die deinen Szenen
den aktuellen Zeitraum sagt, und ein **Widget „Nebenzeiten“** für das Dashboard.

> Mit der automatischen Testsuite und der Tarif-Engine von Gladys 5.2.0 getestet, noch nicht auf einer
> echten Gladys-Instanz: Rückmeldungen sind im Gladys-Forum oder in den GitHub-Issues willkommen.

## Voraussetzungen

- Gladys Assistant **5.2.0** oder neuer (Energieverträge).
- Ein Stromzähler in Gladys, dessen Verbrauch alle 30 Minuten bekannt ist (Integration
  Energieüberwachung: Linky über Enedis, ein Lixee- oder Tasmota-Index…).
- Ein Vertrag EDF Zen Week-End oder Zen Week-End Plus. Kein Konto, kein API-Schlüssel, kein
  Netzwerkzugriff: Alles wird auf deinem Gladys berechnet.

## Installation und Einrichtung

Installiere die Integration (**Integrationen → Von GitHub installieren**, Adresse
`https://github.com/guim31/gladys-edf-zen-weekend`). Auf ihrer Konfigurationsseite gibt es nichts
auszufüllen außer der Sprache der Szenentexte.

### Den Vertrag anlegen

1. Öffne **Integrationen → Energieüberwachung → Verträge** und lege einen Vertrag an.
2. Wähle eine der vier Vorlagen **EDF Zen Week-End** (siehe unten), dann deinen Stromzähler und das
   Startdatum deines Vertrags.
3. Prüfe die vorbelegten Werte mit deiner Rechnung: Nebenzeiten, Preise, Grundgebühr. Speichere.

Gladys rechnet dann jede halbe Stunde Verbrauch mit diesem Vertrag ab, ab seinem Startdatum, auch
rückwirkend.

### Welche Vorlage?

| Vorlage                                            | Günstigerer Preis                                        |
| -------------------------------------------------- | -------------------------------------------------------- |
| EDF Zen Week-End (Option Week-End)                 | Wochenende und Feiertage                                 |
| EDF Zen Week-End (Nebenzeiten + Wochenende)        | Wochenende, Feiertage, Enedis-Nebenzeiten                |
| EDF Zen Week-End Plus (Wochenende + gewählter Tag) | Wochenende, Feiertage, gewählter Tag                     |
| EDF Zen Week-End Plus (Nebenzeiten + WE + Tag)     | Wochenende, Feiertage, gewählter Tag, Enedis-Nebenzeiten |

Die Option **Flex** von Zen Week-End wird nicht angeboten, denn ihre „Spartage“ kündigt EDF Tag für Tag an, und
noch kein Gladys-Kalender liefert sie.

### Preise und Grundgebühr

Die Vorlagen sind mit den offiziellen EDF-Preistabellen vorbelegt, **gültig ab dem 15. September 2026**
(Bruttopreise, für Neuverträge):

| Option                               | Voller Preis (€/kWh) | Günstigerer Preis (€/kWh) |
| ------------------------------------ | -------------------- | ------------------------- |
| Zen Week-End, Week-End               | 0,2285               | 0,1710                    |
| Zen Week-End, Nebenzeiten + WE       | 0,2359               | 0,1762                    |
| Zen Week-End Plus, WE + Tag          | 0,2259               | 0,1691                    |
| Zen Week-End Plus, Nebenzeiten + Tag | 0,2314               | 0,1731                    |

Die monatliche Grundgebühr hängt von deiner Anschlussleistung ab und ist für alle Optionen gleich
(€/Monat brutto): 3 kVA 12,13 (nur Option Week-End) · 6 kVA 15,86 · 9 kVA 19,88 · 12 kVA 23,76 ·
15 kVA 27,40 · 18 kVA 31,14 · 24 kVA 39,14 · 30 kVA 46,47 · 36 kVA 53,88. Die Vorlage ist für 6 kVA
vorbelegt: Trage deine ein.

Die **Nebenzeiten** legt Enedis für jede Wohnung fest, sie stehen auf deiner Rechnung und auf enedis.fr.
Die Vorlage ist mit 04:00-08:00 und 12:30-16:30 vorbelegt; die meisten Wohnungen haben Nachtstunden (zum
Beispiel 22:00-06:00): Wähle deine im Raster.

### Sprache

Das Feld **Sprache der Szenentexte** (standardmäßig Französisch) legt die Sprache der Zeitraumnamen und
Uhrzeiten fest, die an die Szenen gehen. Das Widget folgt der Sprache jedes Benutzers. Die Zeitraumnamen im
Widget „Strompreis“ von Gladys kommen aus dem Vertrag und bleiben französisch („Heures creuses“,
„Week-end“, „Jour férié“…), die Wörter der Rechnung.

## Was Gladys berechnet

Der Vertrag wird von Gladys selbst berechnet, mit den Regeln der Vorlage:

1. ein **Feiertag** (nur landesweite Feiertage: Karfreitag und der 26. Dezember, Feiertage nur in
   Elsass-Mosel, sind bei EDF nicht günstiger) ist von 0:00 bis 24:00 günstiger;
2. das **Wochenende** ist von Samstag 0:00 bis Sonntag 24:00 günstiger;
3. der **gewählte Tag** des Angebots Plus ist von 0:00 bis 24:00 günstiger;
4. die **Nebenzeiten** sind an den übrigen Tagen günstiger;
5. der Rest der Zeit gilt der volle Preis.

Die Integration veröffentlicht die Feiertage im Kalender `holidays-fr` von Gladys, etwa eine Woche im
Voraus (Gladys lehnt weiter entfernte Daten ab), und zurück bis zum Beginn deines Vertrags. Ist die
Integration gestoppt, wird ein Feiertag, den sie nicht rechtzeitig veröffentlichen konnte, wie ein Werktag
berechnet; sobald er veröffentlicht ist, berechnet Gladys die Kosten neu. Andere Vorlagen können denselben
Kalender `holidays-fr` lesen.

## Dashboard-Widget

**Nebenzeiten** zeigt den aktuellen Zeitraum (Nebenzeit, Hauptzeit, Wochenende, Feiertag, gewählter Tag),
den aktuellen Preis, die Zeit bis zum nächsten Wechsel, diesen Wechsel, die Nebenzeiten von heute und
morgen und den nächsten Feiertag. Es beschreibt deinen neuesten aktiven EDF-Zen-Week-End-Vertrag.

Es ergänzt das Widget **Strompreis** von Gladys, das den aktuellen und den nächsten Preis innerhalb der
nächsten 48 Stunden zeigt.

## Szenenauslöser

- **Beginn der Nebenzeit**: Der günstigere Preis beginnt, auf die Minute genau. Filter: der beginnende
  Zeitraum (Nebenzeit, Wochenende, Feiertag, gewählter Tag; leer für alle). Variablen: Zeitraum (Schlüssel
  und Name), Preis, Minuten bis zum nächsten Wechsel, Uhrzeit des nächsten Wechsels.
- **Ende der Nebenzeit**: Der volle Preis gilt wieder. Variablen: Preis, Minuten bis zur Rückkehr des
  günstigeren Preises, deren Uhrzeit, der nächste günstige Zeitraum (Schlüssel und Name).

Ein Wechsel zwischen zwei günstigen Zeiträumen (vom Sonntagabend in die nächtliche Nebenzeit am Montag)
löst nichts aus: Der Preis bleibt günstig. Den Auslöser **Strompreis geändert** von Gladys gibt es auch; er
läuft alle 30 Minuten und löst bei jeder Änderung von Preis oder Name aus, auch bei dieser.

## Szenenaktion „EDF-Tarifzeitraum lesen“

Gibt den folgenden Aktionen der Szene: `off_peak` (wahr oder falsch), den Zeitraum (Schlüssel und Name),
den aktuellen Preis, die Minuten bis zum nächsten Wechsel und dessen Uhrzeit. Die Aktion schlägt fehl, wenn kein
aktiver Vertrag eine Vorlage der Integration nutzt.

## Szenenbeispiele

- **Warmwasserspeicher**: Auslöser „Beginn der Nebenzeit“ (Zeitraum: Nebenzeit) → Steckdose des Speichers
  einschalten; Auslöser „Ende der Nebenzeit“ → ausschalten.
- **Auto nur zum günstigeren Preis laden**: Auslöser „das Auto ist angesteckt“ → Aktion
  „EDF-Tarifzeitraum lesen“ → nur fortfahren, wenn `off_peak` wahr ist → Laden starten.
- **Waschmaschine**: Aktion „EDF-Tarifzeitraum lesen“, nur fortfahren, wenn noch 120 Minuten oder mehr bis
  zum Wechsel bleiben, dann die Maschine starten.
- **Benachrichtigung**: Auslöser „Ende der Nebenzeit“ → „Voller Preis bis {{next_change}}“ senden.

## Wenn EDF die Preise ändert

EDF überprüft die Preise seiner Marktangebote bis zu zweimal im Jahr. Eine neue Tabelle wird eine neue
Version der Integration, mit nach der Tabelle datierten Vorlagen. Gladys ändert einen Vertrag nie von sich
aus: Korrigiere die Preise deines Vertrags oder lege ab dem Datum der Änderung einen neuen Vertrag aus der
aktualisierten Vorlage an. Deine Rechnung gilt immer vor den vorbelegten Werten.

## Fehlerbehebung

- **Keine Vorlage im Assistenten**: Gladys 5.2.0 oder neuer ist nötig, und die Integration muss installiert
  sein.
- **Ein Feiertag zum vollen Preis**: Prüfe, ob die Integration in der Woche davor lief; in ihren Logs listet
  „Published … public holiday(s)“ die Veröffentlichungen.
- **„Feiertagskalender: von einer anderen Integration“** im Widget: Eine andere Integration liefert
  `holidays-fr` bereits; die Vorlagen lesen ihn.
- **Falsche Nebenzeiten**: Ändere den Vertrag unter Energieüberwachung → Verträge. Die Integration liest
  die Verträge innerhalb von 10 Minuten neu.
- **Kein Szenenereignis**: Die Integration sendet keines, wenn sie einen Wechsel mit mehr als 15 Minuten
  Verspätung bemerkt (Gladys nicht erreichbar, Rechner im Ruhezustand).

## Grenzen

- Die Preise sind die von EDF am 15. September 2026 für Neuverträge; ein älterer Vertrag kann andere haben.
- Der Aufschlag für Eigenerzeuger (9,84 € netto pro Jahr) ist nicht enthalten.
- Die Option Flex wird nicht unterstützt.
- Die Nebenzeiten folgen dem 30-Minuten-Raster des Gladys-Assistenten.
- Den gewählten Tag zu ändern (zweimal pro Vertragsjahr) bedeutet einen neuen Vertrag ab dem Datum der
  Änderung.
- Nicht mit EDF oder Enedis verbunden. „EDF“ und „Zen Week-End“ sind Marken ihrer Inhaber.

## Credits

- Preise: EDF-Preistabellen „Zen Week-End“ und „Zen Week-End Plus“, gültig ab dem 15. September 2026
  (particulier.edf.fr).
- Tarif-Engine und Vertragsassistent: Gladys Assistant 5.2.0 (Apache 2.0).
