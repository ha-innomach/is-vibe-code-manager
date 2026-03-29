# 🚀 Snelstartgids: Improvers Studio Vibe Code Manager

Welkom bij de **Improvers Studio Vibe Code Manager (VCM)**. Deze tool zorgt ervoor dat je lokale ontwikkelomgeving—SSH aliases, Git identiteiten en workspace context—altijd perfect gesynchroniseerd is met je professionele profielen.

---

## 🔑 1. Vereisten
Voordat je begint, zorg ervoor dat je hebt:
- **SSH Keys**: Je privésleutels moeten in `~/.ssh/` staan.
- **Git**: Geïnstalleerd en toegankelijk via je terminal.
- **Standalone App**: De app is volledig zelfstandig en heeft geen externe runtime nodig.

---

## 🏗️ 2. Je eerste bedrijf instellen
Klik op **"Bedrijven"** in de zijbalk om de configuratie-wizard te starten.

1. **Bedrijfsidentiteit**: Geef een weergavenaam op (bijv. "Acme Corp") en een ID (bijv. `acme`).
2. **Git Handtekening**: Voer de naam en het e-mailadres in die je gebruikt voor de repositories van dit bedrijf.
   - *Voorbeeld: Hans Anton | hans@acme.com*
3. **SSH Context**:
   - **Host Alias**: De snelkoppeling die je in je SSH URL's gebruikt (bijv. `github-acme`).
   - **SSH Key Path**: Wijs naar je specifieke privésleutel voor dit bedrijf.
4. **Workspace Roots**: Vertel VCM waar je de code van dit bedrijf kloont (bijv. `~/Projects/acme/`).

---

## 🔍 3. Een Repository Inspecteren
Niet zeker of een repository correct is geconfigureerd? Gebruik de **Repo Inspector**.

1. Ga naar **Repositories**.
2. Klik op **Kies Map** en selecteer een git-repository op je machine.
3. VCM controleert direct:
   - Of het huidige Git-e-mailadres overeenkomt met de bedrijfscontext.
   - Of de remote origin het juiste SSH-host-alias gebruikt.
   - Of de map zich binnen een beheerde workspace-root bevindt.

---

## 🛠️ 4. Preview & Wijzigingen Toepassen
VCM volgt een "Desired State" filosofie. Het verandert je bestanden niet zonder jouw toestemming.

1. Ga naar de **Preview / Toepassen** pagina.
2. Bekijk de voorgestelde patches voor `~/.ssh/config` en `~/.gitconfig`.
3. Klik op **Alle Wijzigingen Toepassen** om je systeem te synchroniseren.

---

## 🛡️ Veiligheid & Handmatige Overwrites
VCM is ontworpen om veilig en niet-destructief te zijn.

### Beheerde Blokken
VCM wijzigt alleen code binnen onze specifieke markers:
```ssh
# IMPROVERS.STUDIO VCM: START [id]
... beheerde configuratie ...
# IMPROVERS.STUDIO VCM: END [id]
```
Alles wat je *buiten* deze markers schrijft, blijft onveranderd.

### Automatische Back-ups
Elke keer dat je op "Toepassen" klikt, maakt VCM een back-up met tijdstempel van de bestanden die worden gewijzigd.
*Voorbeeld: `~/.ssh/config.20230329124500.bak`*

---

## 🩺 Hulp Nodig?
Gebruik de **Configuratie Dokter** om veelvoorkomende problemen te diagnosticeren, zoals ontbrekende SSH-sleutels of gebroken git-include verwijzingen.

> [!TIP]
> Gebruik het **Dashboard** voor een vogelvlucht op de gezondheid en activiteit van je volledige ontwikkelomgeving.

---
*Improvers Studio — Unified environment orchestration for distributed engineering teams.*

## 🧑‍💻 Veelgestelde Vragen

### Hoe werkt de integratie met VS Code?
Je hoeft in VS Code niets extra's in te stellen. VCM schrijft regels naar je globale `~/.gitconfig` en `~/.ssh/config`. Wanneer je een map opent die in een van je geconfigureerde **Workspace Roots** ligt, schakelt Git (en dus VSC) automatisch over naar de juiste identiteit en SSH-sleutel.

### Veilig inloggen op mijn VPS (SSH Setup)
Als je een nieuwe VPS toevoegt, log je vaak eerst in met `root` en een wachtwoord. VCM helpt je om dit veiliger te maken:
1. Voeg de VPS toe in de **Deployment** stap van de wizard.
2. Gebruik de **SSH Provisioning Helper** om je publieke sleutel naar de server te kopiëren.
3. VCM maakt een alias aan (bijv. `ssh [bedrijf]-vps`), zodat je voortaan zonder wachtwoord kunt inloggen.

### Waarom zie ik meerdere bedrijven in de preview?
VCM streeft naar een "Desired State". Dit betekent dat we ervoor zorgen dat *al* je professionele contexten tegelijkertijd klaarstaan op je computer. Het systeem is slim genoeg om de juiste te kiezen op basis van de map waar je in werkt.
