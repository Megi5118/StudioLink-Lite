# StudioLink Lite 1.6.1 — poprawka ChatGPT

Data: 4 września 2026. Podstawa: publiczne repozytorium [Megi5118/StudioLink-Lite](https://github.com/Megi5118/StudioLink-Lite), commit `56a990c` (wersja 1.6.0). Zmiany są lokalne; niczego nie wysłano na GitHub. Oryginalnych kopii na Pulpicie i w Pobranych nie zmieniono.

## Co ustaliłem

1. **Dostępna strona ChatGPT bez logowania ma inny interfejs.** W bezpośredniej obserwacji 4 września formularz miał `data-mobile-composer`, pole `textarea#mobile-composer-prompt`, przycisk `data-composer-submit` oraz `POST /unauth-mweb/conversation`. Brakowało starych `#prompt-textarea` i `#composer-submit-button`. Wtyczka 1.6.0 szukała starych elementów. Pełne przeładowanie po wysłaniu dodatkowo przerywa działający w stronie proces agenta.
2. **Wtyczka mogła przerwać dłuższe myślenie.** Adapter po 10 sekundach bez przyrostu tekstu ignorował nadal widoczny przycisk Stop i próbował automatycznie go nacisnąć. Wspólny kod miał też skrót uznający stabilny tekst po 9 sekundach za zakończony, nawet przy aktywnym generowaniu.
3. **Start mógł fałszywie zgłaszać gotowość.** Niektóre wyniki błędne/puste przechodziły do „Agent ready”; obecność samego promptu mogła ponownie aktywować niedokończoną sesję.
4. **Odczyt kodu mógł zwracać starą wersję.** Pamięć CodeMirror porównywała długość dokumentu. Zmiana `return 1` na `return 2` mogła pozostawić poprzednią treść do wykonania.

Pierwszy punkt dotyczy zaobserwowanej strony bez logowania, a nie potwierdzonej zmiany wszystkich zalogowanych kont. Nie ustaliłem daty wdrożenia tej zmiany przez OpenAI. Pozostałe błędy wynikają bezpośrednio z kodu i zostały objęte testami regresji.

## Co zmienia wersja 1.6.1

- Nie przerywa automatycznie odpowiedzi tylko dlatego, że tekst chwilowo się nie zmienia. Przycisk Stop użytkownika nadal działa.
- Wybiera widoczne pole wpisywania, obsługuje textarea oraz sprawdza całą wpisaną wiadomość przed wysłaniem. Zablokowany przycisk lub odrzucony tekst daje błąd zamiast pozornego sukcesu.
- Rozpoznaje nieobsługiwany lekki interfejs i pokazuje komunikat o zalogowaniu/pełnym interfejsie. **Nie dodaje obsługi jego pełnostronicowego formularza.** Samo dodanie nowych selektorów nie wystarczyłoby do bezpiecznej obsługi tego trybu.
- Nie oznacza błędnego lub porzuconego startu jako gotowego, również po odświeżeniu; nie wysyła opóźnionego wyniku startowego do innej rozmowy.
- Odświeża kod po zmianie dokumentu o tej samej długości i usuwa nieaktualny odczyt po utracie dostępu do edytora CodeMirror.

Zakres zmian produkcyjnych: adapter ChatGPT, odczyt CodeMirror, niezbędne fragmenty startu i oczekiwania w `core/main.js`, stan w popupie, mocowanie paska w CSS oraz numer wersji. Nie zmieniano innych adapterów, transportu, `bridge.py` ani uprawnień rozszerzenia. Mostek nadal zgłasza 1.6.0 — to oczekiwane.

## Testy

- Chromium, rzeczywisty DOM lokalnych formularzy: **15/15**.
- Regresje uruchamiania i oczekiwania na ChatGPT, Node: **17/17**.
- Dotychczasowe testy odczytu ChatGPT: **8/8**.
- Inicjalizacja wspólnego skryptu: **PASS**.
- Metadane i kontrola wydania rozszerzenia, Python: **5/5**.
- Kontrola składni zmienionych skryptów i `git diff --check`: **PASS**.

Nie wykonano pełnego testu zalogowany ChatGPT → rozszerzenie → Roblox Studio. Dostępna przeglądarka nie była zalogowana do ChatGPT. Testy formularzy nie odtwarzają całego React/ProseMirror produkcyjnej strony. Brak dodatkowego audytu niezmienionego mostka i pozostałych dostawców jest celowym ograniczeniem zakresu.

## Instalacja w Brave / Chrome / Edge

1. Zachowaj starą wersję jako kopię zapasową. Nowy folder trzymaj w stałym miejscu, nie usuwaj go po instalacji.
2. Wejdź na `brave://extensions`, `chrome://extensions` albo `edge://extensions`. Wyłącz dotychczasową kopię StudioLink Lite, aby nie działały dwa rozszerzenia jednocześnie.
3. Włącz tryb programisty, wybierz **Załaduj rozpakowane / Load unpacked** i wskaż podfolder `studiolink-lite-extension` z wersji 1.6.1 — nie cały folder projektu ani ZIP.
4. Sprawdź numer 1.6.1 na karcie rozszerzenia. Odśwież wszystkie otwarte karty ChatGPT.
5. Uruchom mostek przez `start.bat`, jeśli jeszcze nie działa. Jeśli stary mostek już działa, nie uruchamiaj drugiego na tym samym porcie.
6. Otwórz Roblox Studio z testowym miejscem i włącz Studio as MCP server. Zaloguj się do ChatGPT, otwórz nową, pustą rozmowę i kliknij Start w StudioLink Lite.
7. Pierwszy test wykonaj na kopii miejsca: poproś wyłącznie o odczyt nazwy otwartego miejsca, bez zmian. Sprawdź odpowiedź i wykonanie narzędzia. Dopiero potem testuj budowanie.

Jeżeli nadal pojawia się „Page not ready”, komunikat wtyczki opisze brakujące pole lub nieobsługiwany interfejs. Do dalszej diagnozy wystarczy ten komunikat i zrzut strony/paska wtyczki bez prywatnej treści rozmów. Nie przesyłaj haseł, tokenów ani ciasteczek.

Powrót do starej wersji: wyłącz 1.6.1, włącz zachowaną 1.6.0 i odśwież kartę ChatGPT.
