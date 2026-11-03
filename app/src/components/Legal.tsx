import { CONSENT_VERSION, LEGAL } from '../config'

const pending = (v: string) => v || '[pendent de completar]'

export function Legal({ onBack }: { onBack: () => void }) {
  return (
    <div className="legal-layer" role="dialog" aria-label="Privacitat i avís de salut">
    <main className="screen legal">
      <header className="legal-head">
        <button type="button" className="btn ghost" onClick={onBack}>
          ← Torna
        </button>
        <h1>Privacitat i avís de salut</h1>
        <p className="muted small">
          Última actualització: {LEGAL.updated} · versió del consentiment {CONSENT_VERSION}
        </p>
      </header>

      <section className="card legal-sec warn-sec">
        <h2>Avís de salut</h2>
        <p>
          Embranzida proposa plans d’entrenament generals a partir de les teves respostes. No és un servei mèdic ni
          substitueix el consell d’un professional sanitari o d’un entrenador que et vegi en persona.
        </p>
        <ul>
          <li>Si has respost «sí» a alguna pregunta del qüestionari de salut, consulta un professional sanitari abans d’augmentar l’activitat física.</li>
          <li>Atura l’exercici si notes dolor al pit, mareig, falta d’aire desproporcionada o dolor articular agut, i demana atenció mèdica si cal.</li>
          <li>Les càrregues i els volums són orientatius: adapta’ls a com et trobes i prioritza sempre la tècnica correcta.</li>
          <li>L’app està pensada per a persones adultes (18 anys o més).</li>
        </ul>
      </section>

      <section className="card legal-sec">
        <h2>Qui és responsable de les dades</h2>
        <p>
          Responsable del tractament: {pending(LEGAL.controller)}.
          <br />
          Contacte per a qualsevol qüestió de privacitat: {pending(LEGAL.contact)}.
        </p>
      </section>

      <section className="card legal-sec">
        <h2>Quines dades guardem</h2>
        <ul>
          <li>L’àlies que tries (no cal el nom real) i, si ho indiques, la franja d’edat i el sexe.</li>
          <li>La disponibilitat, el material, els objectius i les limitacions que escriguis.</li>
          <li>Del qüestionari de salut (PAR-Q+), només si hi ha alguna resposta afirmativa, no quines.</li>
          <li>Els resultats dels tests, les mesures corporals (pes, cintura, maluc) i l’estat diari (son, energia, molèsties, ànim).</li>
          <li>El pla d’entrenament i el registre de sessions i sèries.</li>
        </ul>
        <p>
          No demanem el nom real. El correu és opcional: només el guardem si el vincules al compte per poder-hi entrar
          des d’un altre mòbil, i es guarda separat de les dades d’entrenament. Algunes d’aquestes dades són dades de
          salut, una categoria especial segons el Reglament general de protecció de dades (RGPD).
        </p>
      </section>

      <section className="card legal-sec">
        <h2>Per a què i amb quina base legal</h2>
        <p>
          Les fem servir únicament per generar el teu pla, calcular les càrregues, mostrar-te el progrés i
          sincronitzar-ho entre dispositius. No es venen, no es fan servir per a publicitat ni es comparteixen amb
          tercers per a altres finalitats.
        </p>
        <p>
          La base legal és el teu consentiment explícit (articles 6.1.a i 9.2.a del RGPD), que dones en crear el
          compte i que pots retirar en qualsevol moment esborrant el compte.
        </p>
      </section>

      <section className="card legal-sec">
        <h2>On es guarden</h2>
        <ul>
          <li>Al teu mòbil, perquè l’app funcioni sense connexió.</li>
          <li>
            Al núvol, a Supabase, en servidors de la regió {LEGAL.dataRegion}, amb seguretat per files: cada usuari
            només pot accedir a les seves dades.
          </li>
          <li>L’app es publica a Cloudflare Pages, que només serveix els fitxers de l’aplicació.</li>
        </ul>
        <p>
          Aquests proveïdors actuen com a encarregats del tractament i poden conservar registres tècnics (com
          l’adreça IP) durant un temps limitat per motius de seguretat.
        </p>
      </section>

      <section className="card legal-sec">
        <h2>Quant de temps</h2>
        <p>
          Mentre tinguis el compte. Quan l’esborres des de Compte → Esborrar el compte, se suprimeixen totes les
          dades del núvol i del mòbil de manera immediata.
        </p>
        <p>Els comptes abandonats s’esborren automàticament, amb totes les seves dades:</p>
        <ul>
          <li>Sense correu vinculat: després de 6 mesos sense obrir l’app amb connexió.</li>
          <li>Amb correu vinculat: després de 24 mesos sense activitat.</li>
        </ul>
        <p>
          Sense correu vinculat, el compte només es pot fer servir des del mòbil on es va crear: si es perden les dades
          d’aquell mòbil, ja no s’hi pot tornar a accedir i s’esborrarà en el termini indicat.
        </p>
      </section>

      <section className="card legal-sec">
        <h2>Imatges dels exercicis</h2>
        <p>
          Les fotografies dels exercicis provenen de free-exercise-db (github.com/yuhonas/free-exercise-db), publicades
          en domini públic. Alguns exercicis tenen il·lustracions pròpies d’Embranzida.
        </p>
      </section>

      <section className="card legal-sec">
        <h2>Els teus drets</h2>
        <p>
          Pots accedir a les teves dades, corregir-les, esborrar-les, demanar-ne la portabilitat i retirar el
          consentiment. Des de la pestanya Compte pots descarregar-les totes (JSON i CSV) i esborrar el compte sense
          haver de demanar-ho a ningú. Per a qualsevol altra petició, escriu al contacte indicat més amunt.
        </p>
        <p>
          Si consideres que no s’han tractat bé les teves dades, pots presentar una reclamació a l’Agència Espanyola
          de Protecció de Dades (aepd.es).
        </p>
      </section>
    </main>
    </div>
  )
}
