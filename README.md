# FitFlow

Aplikacja Android do zapisywania treningów siłowych i śledzenia postępów. Zbudowana w Expo SDK 58, React Native, TypeScript i Expo Router.

## Uruchomienie aplikacji

Wymagany Node.js 24 lub nowszy. W katalogu projektu:

```bash
npm install
npm start
```

Otwórz projekt w Expo Go albo emulatorze Androida (`npm run android`). Dziennik zapisuje dane lokalnie w SQLite i działa bez internetu.

## Funkcje

- Dziennik: tworzenie, przeglądanie, edycja i usuwanie treningów.
- Ćwiczenia startowe i własne; serie, ciężar, powtórzenia oraz notatki.
- Historia i wykres najwyższego ciężaru z przypomnieniem, by porównywać również powtórzenia.
- Opcjonalne sugestie AI przez serwer Node.js. Klucz dostawcy pozostaje po stronie serwera.

## Lokalny serwer AI (opcjonalnie)

Serwer używa API zgodnego z formatem OpenAI Chat Completions. Uruchom go z Node.js 24:

```powershell
$env:AI_API_URL = "https://adres-dostawcy/v1"
$env:AI_API_KEY = "wstaw-klucz-lokalnie"
$env:AI_MODEL = "nazwa-modelu"
$env:AI_MONTHLY_REQUEST_LIMIT = "ustalony-limit-zapytań"
node --experimental-strip-types server/index.ts
```

Ustaw `EXPO_PUBLIC_AI_API_URL` na adres serwera osiągalny z telefonu, np. `http://192.168.1.10:8787`, i uruchom ponownie Expo. Nie commituj kluczy. Ustal limit zapytań na podstawie bieżącego cennika dostawcy tak, aby nie przekroczyć budżetu 30 zł miesięcznie. Serwer trwale zapisuje licznik lokalnie i odmawia kolejnych zapytań po osiągnięciu limitu. Do limitu wlicza też nieudane próby połączenia z dostawcą. Używaj jednej instancji serwera, ponieważ licznik budżetu jest lokalnym plikiem. Sugestie są dobrowolne; przed zapytaniem aplikacja informuje o wysłaniu podsumowania bez danych osobowych. Serwer ogranicza rozmiar, częstotliwość i miesięczną liczbę zapytań.

## Struktura

- `src/app` — widoki Expo Router.
- `src/data/database.ts` — operacje na dzienniku.
- `server/index.ts` — serwer pośredniczący dla AI.

Konta, synchronizacja, społeczność, GPS, bieganie i generowanie planów nie należą do pierwszej wersji.
