import type { Lang } from './i18n';

/** Satu bagian halaman hukum: judul dan paragraf. Butir daftar diawali "• ". */
export type LegalSection = { h: string; p: string[] };
export type LegalDoc = { title: string; lead: string; sections: LegalSection[] };

const EMAIL = 'contribute@dareindo.com';
const EFFECTIVE = { id: '19 November 2026', en: '19 November 2026', de: '19. November 2026' };

export const PRIVACY: Record<Lang, LegalDoc> = {
  id: {
    title: 'Kebijakan Privasi',
    lead: `Kebijakan ini menjelaskan data pribadi yang diproses Benih, untuk apa, dan hak Anda berdasarkan Undang-Undang No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP). Berlaku sejak ${EFFECTIVE.id}.`,
    sections: [
      { h: 'Siapa kami', p: [`Benih dikelola oleh PT Daya Reforestasi Indonesia ("Dareindo") sebagai pengendali data pribadi. Hubungi kami di ${EMAIL} untuk semua pertanyaan dan permintaan terkait data pribadi.`] },
      {
        h: 'Data yang kami proses',
        p: [
          '• Akun: email, kata sandi (disimpan terenkripsi oleh penyedia autentikasi), atau data dasar akun Google bila Anda masuk dengan Google.',
          '• Profil: nama, jenis member, nama organisasi, foto profil, kota, dan bio. Nama, jenis member, dan foto profil dapat dilihat publik. Bio, kota, dan riwayat kegiatan bisa Anda sembunyikan dengan mengunci profil.',
          '• Kegiatan: judul, deskripsi, lokasi dan titik peta, tanggal, foto kegiatan, serta daftar peserta dan status kehadiran.',
          '• Pesan: isi pesan langsung dan percakapan kegiatan, yang hanya bisa dibaca pengirim dan penerimanya.',
          '• Lokasi perangkat: hanya dipakai di peramban Anda untuk mencari kegiatan terdekat, bila Anda mengizinkannya. Kami tidak menyimpannya.',
          '• Transaksi: riwayat Benih dan data rekening untuk penarikan, hanya bila fitur Benih berbayar diaktifkan. Saat ini fitur itu dimatikan.',
        ],
      },
      { h: 'Untuk apa data dipakai', p: ['Untuk menjalankan akun Anda, menampilkan dan mengelola kegiatan, menghubungkan penyelenggara dengan peserta, mengirim email akun (konfirmasi dan atur ulang kata sandi), serta menjaga keamanan platform, termasuk menindaklanjuti laporan penyalahgunaan. Kami tidak menjual data Anda dan tidak memakainya untuk iklan.', 'Dasar pemrosesannya adalah persetujuan Anda saat mendaftar dan pelaksanaan layanan yang Anda minta.'] },
      {
        h: 'Penyedia layanan',
        p: [
          'Data diproses oleh penyedia berikut atas nama kami, masing-masing dengan kebijakan privasinya sendiri:',
          '• Supabase: akun, basis data, dan penyimpanan foto (server di Singapura).',
          '• Hostinger: server aplikasi.',
          '• Google: login Google, peta Google Maps, pencarian lokasi, dan jenis huruf.',
          '• OpenStreetMap Nominatim: pencarian lokasi bila Google Maps tidak tersedia.',
          'Karena sebagian server berada di luar Indonesia, data Anda dapat ditransfer ke luar negeri. Kami hanya memakai penyedia yang menerapkan pelindungan data setara.',
        ],
      },
      { h: 'Yang dilihat pengguna lain', p: ['Kegiatan yang Anda buat, termasuk foto dan lokasinya, bersifat publik. Penyelenggara dapat melihat nama peserta kegiatannya. Jangan unggah foto yang memperlihatkan wajah orang lain tanpa izin mereka, terutama anak-anak.'] },
      { h: 'Berapa lama data disimpan', p: ['Data akun disimpan selama akun aktif. Bila Anda meminta penghapusan akun, data profil, pesan, dan pendaftaran Anda kami hapus paling lambat 30 hari kemudian, kecuali catatan yang wajib disimpan menurut peraturan perpajakan.'] },
      { h: 'Hak Anda', p: [`Anda berhak meminta akses dan salinan data, memperbaiki data, menghapus akun dan data, menarik persetujuan, dan mengajukan keberatan atas pemrosesan. Kirim permintaan ke ${EMAIL} dari email akun Anda. Kami menanggapinya dalam tenggat yang ditetapkan UU PDP.`, 'Bila terjadi kegagalan pelindungan data pribadi yang menyangkut Anda, kami memberi tahu Anda secara tertulis paling lambat 3 x 24 jam sejak kami mengetahuinya.'] },
      { h: 'Anak-anak', p: ['Benih ditujukan untuk pengguna berusia 18 tahun ke atas. Pengguna di bawah 18 tahun hanya boleh memakai Benih dengan persetujuan dan pendampingan orang tua atau wali.'] },
      { h: 'Perubahan', p: ['Bila kebijakan ini berubah, versi terbaru tampil di halaman ini dengan tanggal berlaku baru. Perubahan penting kami beritahukan lewat email atau pemberitahuan di aplikasi.'] },
    ],
  },
  en: {
    title: 'Privacy Policy',
    lead: `This policy explains the personal data Benih processes, why, and your rights under Indonesia's Personal Data Protection Law (Law No. 27 of 2022, "PDP Law"). In effect from ${EFFECTIVE.en}.`,
    sections: [
      { h: 'Who we are', p: [`Benih is run by PT Daya Reforestasi Indonesia ("Dareindo") as data controller. Contact us at ${EMAIL} for any question or request about personal data.`] },
      {
        h: 'Data we process',
        p: [
          '• Account: email, password (stored encrypted by our authentication provider), or basic Google account data if you sign in with Google.',
          '• Profile: name, member type, organisation name, profile photo, city and bio. Name, member type and profile photo are public. You can hide your bio, city and activity history by locking your profile.',
          '• Activities: title, description, location and map point, date, activity photos, and the list of participants and their attendance.',
          '• Messages: direct messages and activity conversations, readable only by sender and recipient.',
          '• Device location: used only in your browser to find nearby activities, if you allow it. We do not store it.',
          '• Transactions: Benih history and bank details for withdrawals, only if paid Benih features are switched on. They are currently switched off.',
        ],
      },
      { h: 'What we use data for', p: ['To run your account, show and manage activities, connect organisers with participants, send account emails (confirmation and password reset), and keep the platform safe, including following up abuse reports. We do not sell your data or use it for advertising.', 'The legal basis is the consent you give when signing up and the performance of the service you request.'] },
      {
        h: 'Service providers',
        p: [
          'The following providers process data on our behalf, each under its own privacy policy:',
          '• Supabase: accounts, database and photo storage (servers in Singapore).',
          '• Hostinger: application server.',
          '• Google: Google sign-in, Google Maps, location search and fonts.',
          '• OpenStreetMap Nominatim: location search when Google Maps is unavailable.',
          'Because some servers are outside Indonesia, your data may be transferred abroad. We only use providers that apply equivalent data protection.',
        ],
      },
      { h: 'What other users see', p: ['Activities you create, including their photos and location, are public. Organisers can see the names of their participants. Do not upload photos showing other people’s faces without their permission, especially children.'] },
      { h: 'How long we keep data', p: ['Account data is kept while your account is active. If you ask us to delete your account, we delete your profile, messages and sign-ups within 30 days, except records we must keep under tax law.'] },
      { h: 'Your rights', p: [`You may ask to access and receive a copy of your data, correct it, delete your account and data, withdraw consent, and object to processing. Send requests to ${EMAIL} from your account email. We respond within the deadlines set by the PDP Law.`, 'If a personal data breach affects you, we will notify you in writing within 3 x 24 hours of becoming aware of it.'] },
      { h: 'Children', p: ['Benih is meant for users aged 18 and over. Users under 18 may only use Benih with the consent and guidance of a parent or guardian.'] },
      { h: 'Changes', p: ['If this policy changes, the latest version appears on this page with a new effective date. We announce significant changes by email or in the app.'] },
    ],
  },
  de: {
    title: 'Datenschutzerklärung',
    lead: `Diese Erklärung beschreibt, welche personenbezogenen Daten Benih verarbeitet, wozu, und welche Rechte Sie nach dem indonesischen Datenschutzgesetz (Gesetz Nr. 27/2022, „PDP-Gesetz“) haben. Gültig ab ${EFFECTIVE.de}.`,
    sections: [
      { h: 'Wer wir sind', p: [`Benih wird von PT Daya Reforestasi Indonesia („Dareindo“) als Verantwortlichem betrieben. Für alle Fragen und Anliegen zu personenbezogenen Daten erreichen Sie uns unter ${EMAIL}.`] },
      {
        h: 'Welche Daten wir verarbeiten',
        p: [
          '• Konto: E-Mail, Passwort (verschlüsselt beim Authentifizierungsanbieter gespeichert) oder Basisdaten Ihres Google-Kontos bei Anmeldung mit Google.',
          '• Profil: Name, Mitgliedstyp, Organisationsname, Profilfoto, Stadt und Bio. Name, Mitgliedstyp und Profilfoto sind öffentlich. Bio, Stadt und Aktivitätsverlauf können Sie durch Sperren Ihres Profils verbergen.',
          '• Aktivitäten: Titel, Beschreibung, Ort und Kartenpunkt, Datum, Fotos sowie Teilnehmerliste und Anwesenheit.',
          '• Nachrichten: Direktnachrichten und Gespräche zu Aktivitäten, nur für Absender und Empfänger lesbar.',
          '• Gerätestandort: nur in Ihrem Browser genutzt, um Aktivitäten in der Nähe zu finden, wenn Sie es erlauben. Wir speichern ihn nicht.',
          '• Transaktionen: Benih-Verlauf und Bankdaten für Auszahlungen, nur wenn kostenpflichtige Benih-Funktionen eingeschaltet sind. Derzeit sind sie ausgeschaltet.',
        ],
      },
      { h: 'Wozu wir Daten nutzen', p: ['Um Ihr Konto zu betreiben, Aktivitäten anzuzeigen und zu verwalten, Organisierende mit Teilnehmenden zu verbinden, Konto-E-Mails zu senden (Bestätigung, Passwort zurücksetzen) und die Plattform sicher zu halten, einschließlich der Bearbeitung von Missbrauchsmeldungen. Wir verkaufen Ihre Daten nicht und nutzen sie nicht für Werbung.', 'Rechtsgrundlage sind Ihre Einwilligung bei der Registrierung und die Erbringung des von Ihnen gewünschten Dienstes.'] },
      {
        h: 'Dienstleister',
        p: [
          'Folgende Anbieter verarbeiten Daten in unserem Auftrag, jeweils nach eigener Datenschutzerklärung:',
          '• Supabase: Konten, Datenbank und Fotospeicher (Server in Singapur).',
          '• Hostinger: Anwendungsserver.',
          '• Google: Google-Anmeldung, Google Maps, Ortssuche und Schriften.',
          '• OpenStreetMap Nominatim: Ortssuche, wenn Google Maps nicht verfügbar ist.',
          'Da einige Server außerhalb Indonesiens stehen, können Ihre Daten ins Ausland übermittelt werden. Wir nutzen nur Anbieter mit gleichwertigem Datenschutz.',
        ],
      },
      { h: 'Was andere sehen', p: ['Von Ihnen erstellte Aktivitäten einschließlich Fotos und Ort sind öffentlich. Organisierende sehen die Namen ihrer Teilnehmenden. Laden Sie keine Fotos mit Gesichtern anderer Menschen ohne deren Erlaubnis hoch, besonders nicht von Kindern.'] },
      { h: 'Speicherdauer', p: ['Kontodaten speichern wir, solange Ihr Konto aktiv ist. Wenn Sie die Löschung Ihres Kontos verlangen, löschen wir Profil, Nachrichten und Anmeldungen innerhalb von 30 Tagen, außer Unterlagen, die wir steuerrechtlich aufbewahren müssen.'] },
      { h: 'Ihre Rechte', p: [`Sie können Auskunft und eine Kopie Ihrer Daten verlangen, Daten berichtigen, Ihr Konto und Ihre Daten löschen lassen, Ihre Einwilligung widerrufen und der Verarbeitung widersprechen. Senden Sie Anfragen von Ihrer Konto-E-Mail an ${EMAIL}. Wir antworten innerhalb der Fristen des PDP-Gesetzes.`, 'Bei einer Datenschutzverletzung, die Sie betrifft, informieren wir Sie schriftlich innerhalb von 3 x 24 Stunden, nachdem wir davon erfahren haben.'] },
      { h: 'Kinder', p: ['Benih richtet sich an Personen ab 18 Jahren. Jüngere dürfen Benih nur mit Zustimmung und Begleitung eines Elternteils oder Vormunds nutzen.'] },
      { h: 'Änderungen', p: ['Ändert sich diese Erklärung, erscheint die neue Fassung auf dieser Seite mit neuem Gültigkeitsdatum. Wesentliche Änderungen kündigen wir per E-Mail oder in der App an.'] },
    ],
  },
};

export const TERMS: Record<Lang, LegalDoc> = {
  id: {
    title: 'Syarat Penggunaan',
    lead: `Dengan membuat akun atau memakai Benih, Anda menyetujui ketentuan berikut. Berlaku sejak ${EFFECTIVE.id}.`,
    sections: [
      { h: 'Tentang Benih', p: ['Benih adalah ruang temu bagi penggiat lingkungan untuk mengumumkan dan mengikuti kegiatan. Benih dikelola oleh PT Daya Reforestasi Indonesia. Kami menyediakan platform, tetapi bukan penyelenggara kegiatan yang dibuat pengguna lain, kecuali disebutkan sebaliknya.'] },
      { h: 'Akun', p: ['Anda wajib memberi data yang benar, menjaga kerahasiaan kata sandi, dan berusia minimal 18 tahun atau didampingi orang tua atau wali. Satu orang atau lembaga tidak boleh memakai akun untuk menyamar sebagai pihak lain.'] },
      { h: 'Tanggung jawab penyelenggara', p: ['Penyelenggara bertanggung jawab atas kebenaran informasi kegiatannya, izin lokasi (termasuk izin pemilik lahan atau otoritas setempat), dan keselamatan peserta di lapangan: pengarahan keselamatan, perlengkapan, dan pertolongan pertama. Kegiatan di lereng curam, perairan, atau cuaca buruk harus ditunda bila tidak aman.'] },
      { h: 'Tanggung jawab peserta', p: ['Peserta ikut atas kehendak sendiri, wajib mengikuti arahan keselamatan penyelenggara, dan menilai sendiri kesanggupan fisiknya. Benih tidak menyediakan asuransi untuk kegiatan pengguna.'] },
      {
        h: 'Yang dilarang',
        p: [
          '• Membuat kegiatan fiktif atau menyesatkan, atau memakai Benih untuk menggalang dana.',
          '• Pelecehan, ujaran kebencian, ancaman, atau spam lewat pesan.',
          '• Mengunggah foto orang lain, terutama anak-anak, tanpa izin, atau konten yang melanggar hak cipta.',
          '• Kegiatan yang melanggar hukum, termasuk menanam atau menebang di kawasan hutan negara atau tanah adat tanpa izin.',
          'Kami dapat menghapus konten dan menangguhkan akun yang melanggar ketentuan ini.',
        ],
      },
      { h: 'Pembayaran dan donasi', p: ['Fitur membeli, mendonasikan, membayar, dan menarik Benih saat ini dimatikan. Tidak ada uang yang dapat dikirim atau diterima lewat Benih. Bila ada yang meminta Anda mentransfer uang atas nama Benih, jangan lakukan dan laporkan kepada kami.'] },
      { h: 'Melaporkan masalah', p: [`Pakai tombol "Laporkan" di halaman kegiatan atau profil, atau kirim email ke ${EMAIL}. Untuk keadaan darurat di lapangan, hubungi 112 atau layanan darurat setempat.`] },
      { h: 'Batas tanggung jawab', p: ['Benih disediakan apa adanya. Sepanjang diizinkan hukum, PT Daya Reforestasi Indonesia tidak bertanggung jawab atas kerugian, cedera, atau sengketa yang timbul dari kegiatan yang diselenggarakan pengguna lain.'] },
      { h: 'Hukum yang berlaku', p: [`Ketentuan ini tunduk pada hukum Republik Indonesia. Data pribadi diatur dalam Kebijakan Privasi. Pertanyaan dapat dikirim ke ${EMAIL}.`] },
    ],
  },
  en: {
    title: 'Terms of Use',
    lead: `By creating an account or using Benih you agree to the following terms. In effect from ${EFFECTIVE.en}.`,
    sections: [
      { h: 'About Benih', p: ['Benih is a meeting place for environmental activists to announce and join activities. It is run by PT Daya Reforestasi Indonesia. We provide the platform but do not organise activities created by other users unless stated otherwise.'] },
      { h: 'Accounts', p: ['You must give accurate information, keep your password secret, and be at least 18 or accompanied by a parent or guardian. No person or organisation may use an account to impersonate someone else.'] },
      { h: 'Organisers’ responsibilities', p: ['Organisers are responsible for accurate activity information, permission to use the location (including from the landowner or local authority), and participants’ safety on site: safety briefing, equipment and first aid. Activities on steep slopes, in water or in bad weather must be postponed if unsafe.'] },
      { h: 'Participants’ responsibilities', p: ['Participants join of their own free will, must follow the organiser’s safety instructions, and judge their own physical ability. Benih does not insure user activities.'] },
      {
        h: 'Not allowed',
        p: [
          '• Creating fake or misleading activities, or using Benih to raise funds.',
          '• Harassment, hate speech, threats or spam in messages.',
          '• Uploading photos of other people, especially children, without permission, or content that infringes copyright.',
          '• Unlawful activities, including planting or felling in state forest areas or customary land without permission.',
          'We may remove content and suspend accounts that break these terms.',
        ],
      },
      { h: 'Payments and donations', p: ['Buying, donating, paying and withdrawing Benih are currently switched off. No money can be sent or received through Benih. If anyone asks you to transfer money in Benih’s name, do not do it and report it to us.'] },
      { h: 'Reporting problems', p: [`Use the "Report" button on an activity or profile page, or email ${EMAIL}. For emergencies on site, call 112 or the local emergency service.`] },
      { h: 'Liability', p: ['Benih is provided as is. To the extent permitted by law, PT Daya Reforestasi Indonesia is not liable for losses, injuries or disputes arising from activities organised by other users.'] },
      { h: 'Governing law', p: [`These terms are governed by the laws of the Republic of Indonesia. Personal data is covered by the Privacy Policy. Questions can be sent to ${EMAIL}.`] },
    ],
  },
  de: {
    title: 'Nutzungsbedingungen',
    lead: `Mit der Erstellung eines Kontos oder der Nutzung von Benih stimmen Sie den folgenden Bedingungen zu. Gültig ab ${EFFECTIVE.de}.`,
    sections: [
      { h: 'Über Benih', p: ['Benih ist ein Treffpunkt für Umweltengagierte, um Aktivitäten anzukündigen und daran teilzunehmen. Betreiber ist PT Daya Reforestasi Indonesia. Wir stellen die Plattform bereit, organisieren aber keine Aktivitäten anderer Nutzer, sofern nicht anders angegeben.'] },
      { h: 'Konten', p: ['Sie müssen zutreffende Angaben machen, Ihr Passwort geheim halten und mindestens 18 Jahre alt sein oder von einem Elternteil oder Vormund begleitet werden. Niemand darf ein Konto nutzen, um sich als andere Person oder Organisation auszugeben.'] },
      { h: 'Pflichten der Organisierenden', p: ['Organisierende sind verantwortlich für zutreffende Angaben, die Erlaubnis zur Nutzung des Ortes (auch von Landeigentümern oder Behörden) und die Sicherheit der Teilnehmenden vor Ort: Sicherheitseinweisung, Ausrüstung und Erste Hilfe. Aktivitäten an steilen Hängen, am Wasser oder bei Unwetter sind zu verschieben, wenn sie unsicher sind.'] },
      { h: 'Pflichten der Teilnehmenden', p: ['Teilnehmende nehmen freiwillig teil, folgen den Sicherheitsanweisungen und schätzen ihre körperliche Belastbarkeit selbst ein. Benih versichert keine Aktivitäten von Nutzern.'] },
      {
        h: 'Nicht erlaubt',
        p: [
          '• Erfundene oder irreführende Aktivitäten oder die Nutzung von Benih zum Spendensammeln.',
          '• Belästigung, Hassrede, Drohungen oder Spam in Nachrichten.',
          '• Fotos anderer Menschen, besonders von Kindern, ohne Erlaubnis hochzuladen, oder urheberrechtsverletzende Inhalte.',
          '• Rechtswidrige Aktivitäten, etwa Pflanzen oder Fällen in staatlichen Waldgebieten oder auf Gewohnheitsland ohne Genehmigung.',
          'Wir können Inhalte entfernen und Konten sperren, die gegen diese Bedingungen verstoßen.',
        ],
      },
      { h: 'Zahlungen und Spenden', p: ['Kaufen, Spenden, Bezahlen und Auszahlen von Benih sind derzeit ausgeschaltet. Über Benih kann kein Geld gesendet oder empfangen werden. Wenn jemand Sie im Namen von Benih um eine Überweisung bittet, tun Sie es nicht und melden Sie es uns.'] },
      { h: 'Probleme melden', p: [`Nutzen Sie die Schaltfläche „Melden“ auf Aktivitäts- oder Profilseiten oder schreiben Sie an ${EMAIL}. In Notfällen vor Ort rufen Sie die 112 oder den örtlichen Notdienst.`] },
      { h: 'Haftung', p: ['Benih wird ohne Gewähr bereitgestellt. Soweit gesetzlich zulässig, haftet PT Daya Reforestasi Indonesia nicht für Schäden, Verletzungen oder Streitigkeiten aus Aktivitäten anderer Nutzer.'] },
      { h: 'Anwendbares Recht', p: [`Es gilt das Recht der Republik Indonesien. Personenbezogene Daten regelt die Datenschutzerklärung. Fragen senden Sie an ${EMAIL}.`] },
    ],
  },
};
