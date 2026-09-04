# StudioLink Lite 1.6.3 — układ i readback ChatGPT

Poprawka obejmuje przesunięty pasek/przyciski ze zrzutów oraz błąd zatrzymywania dużego promptu po jego wpisaniu. Nie zmienia narzędzi Roblox ani pozostałych integracji.

## Nowy błąd z dużym promptem

Jeśli po wpisaniu całej treści ChatGPT przez React wymieni element edytora, wcześniejsza kontrola porównywała chwilowy węzeł DOM znak w znak i pokazywała „did not accept the complete message”. W 1.6.3 porównywana jest pełna treść logiczna; tolerowane są wyłącznie końce linii, NBSP i końcowe znaki nowej linii dodane przez DOM. Element musi pozostać w tym samym composerze. Gdy brakuje choćby części treści, wysyłka nadal zostaje zablokowana.

## Przyczyna i poprawka

Wersja 1.6.1 wstawiała pasek jako dziecko siatki ChatGPT z `grid-area: header`. Gdy siatka nie definiuje obszaru `header`, przeglądarka tworzy dodatkową kolumnę. Odtworzyłem w ten sposób charakterystyczny układ ze zrzutów: przyciski strony po lewej i pasek rozszerzenia niżej, po prawej.

Teraz pasek pozostaje we własnej warstwie rozszerzenia, jest wyrównany do całej szerokości kompozytora i ma zarezerwowane miejsce nad polem wiadomości. Nie uczestniczy w siatce ChatGPT. Natywne przyciski zachowują swoje pozycje. W wąskim oknie zawijają się tylko kontrolki rozszerzenia.

Zmiany produkcyjne względem 1.6.1: `providers/chatgpt.js` (mocowanie paska), `overlay.css` (wyłącznie reguły ChatGPT), jedna linia odstępu paska w `core/main.js` oraz numer wersji w `manifest.json`. Pozostałe pliki produkcyjne pozostają identyczne.

## Weryfikacja

Problem odtworzono w lokalnym modelu układu ze zrzutów, z rzeczywistym adapterem, CSS i skryptem interfejsu rozszerzenia. Po poprawce: 49/49 sprawdzeń geometrii i 15/15 regresji edytora. Sprawdzone zostały oba warianty siatki, puste pole, tekst jedno- i wielowierszowy, szerokości 768 i 340 px oraz odtworzenie edytora.

To nie jest test bezpośrednio w Twojej zalogowanej karcie: dostępna do sterowania przeglądarka Codex nie udostępnia tej karty. Dlatego nie zmieniałem Twojej działającej sesji ani zainstalowanej kopii bezpośrednio.

## Jak włączyć poprawkę

1. Wyłącz poprzednią kopię StudioLink Lite na stronie rozszerzeń przeglądarki.
2. Wybierz **Załaduj rozpakowane** i wskaż `studiolink-lite-extension` z tego folderu. Sprawdź numer **1.6.2**.
3. Odśwież kartę ChatGPT — to konieczne, aby usunąć stary pasek i stary CSS z otwartej strony.

Możesz też skopiować cztery wymienione pliki do dotychczasowego folderu rozszerzenia, następnie kliknąć **Odśwież** na jego karcie i odświeżyć ChatGPT. Zachowana paczka 1.6.1 pozwala cofnąć zmianę. Mostka nie trzeba wymieniać ani ponownie konfigurować.
