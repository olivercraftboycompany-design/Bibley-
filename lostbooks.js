/* Bibley 5.2: Lost Books (Outside the Canon).
   A separate, passkey-locked section with ancient writings that are NOT part of the Protestant Bible.
   Nothing here is mixed into the normal Bible: not the book list, search, verse of the day, plans or AI.
   Texts are public domain only (credits on each book and on the About page).
   The passkey is a privacy lock, NOT encryption: the texts are public and ship with the app.
   Stored on this device only: "bibley_lostbooks_hash", "bibley_lostbooks_salt" (salted SHA-256 of the passkey),
   "bibley_lostbooks_last" (last chapter read), "bibley_lostbooks_size" (text size). */
(function () {
  "use strict";
  if (window.__bibleyLostBooks) return; window.__bibleyLostBooks = 1;
  const K_HASH = "bibley_lostbooks_hash", K_SALT = "bibley_lostbooks_salt", K_LAST = "bibley_lostbooks_last", K_SIZE = "bibley_lostbooks_size";
  const IDLE_MS = 5 * 60 * 1000;
  const BOOKS = [{"id":"tobit","t":"Tobit","g":"Deuterocanon / Apocrypha","f":"lb-apocrypha.json","i":"A Jewish story from around the 200s BC about a faithful man, his son Tobias and the angel Raphael. It is in Catholic and Orthodox Bibles; Protestants left it out because it was never part of the Hebrew Bible.","cr":"World English Bible (public domain), from ebible.org","cl":"Chapter","n":["1","2","3","4","5","6","7","8","9","10","11","12","13","14"]},{"id":"judith","t":"Judith","g":"Deuterocanon / Apocrypha","f":"lb-apocrypha.json","i":"A Jewish story from around 100 BC about a widow who saves her town from an Assyrian general. Catholic and Orthodox Bibles include it; it is not in the Hebrew Bible, so Protestant Bibles do not.","cr":"World English Bible (public domain), from ebible.org","cl":"Chapter","n":["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16"]},{"id":"esthergreek","t":"Esther (Greek, with additions)","g":"Deuterocanon / Apocrypha","f":"lb-apocrypha.json","i":"The Greek version of Esther adds about 107 verses (prayers, letters and a dream) to the Hebrew book, written around 100 BC. Catholic and Orthodox Bibles keep the additions; Protestant Bibles follow the shorter Hebrew Esther.","cr":"World English Bible (public domain), from ebible.org","cl":"Chapter","n":["1","2","3","4","5","6","7","8","9","10"]},{"id":"wisdom","t":"Wisdom of Solomon","g":"Deuterocanon / Apocrypha","f":"lb-apocrypha.json","i":"A book of Jewish wisdom written in Greek, probably in Alexandria in the first century BC (not by Solomon himself). It is in Catholic and Orthodox Bibles but not in the Hebrew Bible or Protestant Bibles.","cr":"World English Bible (public domain), from ebible.org","cl":"Chapter","n":["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19"]},{"id":"sirach","t":"Sirach (Ecclesiasticus)","g":"Deuterocanon / Apocrypha","f":"lb-apocrypha.json","i":"Wise sayings written by Jesus ben Sira in Jerusalem around 180 BC. Catholic and Orthodox Bibles include it; it was not accepted into the Hebrew Bible, so Protestant Bibles leave it out.","cr":"World English Bible (public domain), from ebible.org","cl":"Chapter","n":["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30","31","32","33","34","35","36","37","38","39","40","41","42","43","44","45","46","47","48","49","50","51"]},{"id":"baruch","t":"Baruch","g":"Deuterocanon / Apocrypha","f":"lb-apocrypha.json","i":"A book credited to Jeremiah's scribe Baruch, likely put together in the second or first century BC. It is in Catholic and Orthodox Bibles; it is not in the Hebrew Bible or Protestant Bibles. (Chapter 6, the Letter of Jeremiah, is listed separately here.)","cr":"World English Bible (public domain), from ebible.org","cl":"Chapter","n":["1","2","3","4","5"]},{"id":"letterjeremiah","t":"Letter of Jeremiah","g":"Deuterocanon / Apocrypha","f":"lb-apocrypha.json","i":"A short warning against idols, written around 300-100 BC and credited to Jeremiah. Catholic Bibles print it as Baruch chapter 6; Orthodox Bibles as a separate book. It is not in the Hebrew Bible.","cr":"World English Bible (public domain), from ebible.org","cl":"Chapter","n":["1"]},{"id":"azariah","t":"Prayer of Azariah and Song of the Three Young Men","g":"Deuterocanon / Apocrypha","f":"lb-apocrypha.json","i":"A prayer and a hymn sung in the fiery furnace, added to Daniel 3 in the Greek Bible (around 100 BC). Catholic and Orthodox Bibles include it as Daniel 3:24-90; it is not in the Hebrew Daniel.","cr":"World English Bible (public domain), from ebible.org","cl":"Chapter","n":["1"]},{"id":"susanna","t":"Susanna","g":"Deuterocanon / Apocrypha","f":"lb-apocrypha.json","i":"The story of a woman falsely accused and saved by young Daniel, added to the Greek Daniel (around 100 BC). Catholic Bibles have it as Daniel 13; it is not in the Hebrew Bible.","cr":"World English Bible (public domain), from ebible.org","cl":"Chapter","n":["1"]},{"id":"bel","t":"Bel and the Dragon","g":"Deuterocanon / Apocrypha","f":"lb-apocrypha.json","i":"Two short stories in which Daniel exposes a fake idol and a 'dragon' that was worshiped. Added to the Greek Daniel; Catholic Bibles have it as Daniel 14. Not in the Hebrew Bible.","cr":"World English Bible (public domain), from ebible.org","cl":"Chapter","n":["1"]},{"id":"1maccabees","t":"1 Maccabees","g":"Deuterocanon / Apocrypha","f":"lb-apocrypha.json","i":"History of the Jewish revolt against the Greek king Antiochus IV (167-134 BC), written around 100 BC. Catholic and Orthodox Bibles include it. Protestants value it as history but it is not in the Hebrew Bible.","cr":"World English Bible (public domain), from ebible.org","cl":"Chapter","n":["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16"]},{"id":"2maccabees","t":"2 Maccabees","g":"Deuterocanon / Apocrypha","f":"lb-apocrypha.json","i":"A second account of the Maccabean revolt, focusing on the temple and the martyrs, written around 100 BC. In Catholic and Orthodox Bibles; not in the Hebrew Bible or Protestant Bibles.","cr":"World English Bible (public domain), from ebible.org","cl":"Chapter","n":["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15"]},{"id":"1esdras","t":"1 Esdras","g":"Deuterocanon / Apocrypha","f":"lb-apocrypha.json","i":"A Greek retelling of parts of 2 Chronicles, Ezra and Nehemiah, with an extra story about three guards. Used by the Orthodox church; Catholics put it in an appendix; not in Protestant Bibles.","cr":"World English Bible (public domain), from ebible.org","cl":"Chapter","n":["1","2","3","4","5","6","7","8","9"]},{"id":"2esdras","t":"2 Esdras","g":"Deuterocanon / Apocrypha","f":"lb-apocrypha.json","i":"A Jewish apocalypse (visions of Ezra) written after the temple was destroyed in AD 70, with Christian additions. In the Slavonic Orthodox Bible and the Catholic appendix; not in Protestant Bibles.","cr":"World English Bible (public domain), from ebible.org","cl":"Chapter","n":["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16"]},{"id":"manasseh","t":"Prayer of Manasseh","g":"Deuterocanon / Apocrypha","f":"lb-apocrypha.json","i":"A short prayer of repentance credited to King Manasseh (see 2 Chronicles 33:12-13), written in the last centuries BC. Used by the Orthodox church; in the Catholic appendix; not in Protestant Bibles.","cr":"World English Bible (public domain), from ebible.org","cl":"Chapter","n":["1"]},{"id":"psalm151","t":"Psalm 151","g":"Deuterocanon / Apocrypha","f":"lb-apocrypha.json","i":"A short psalm about David and Goliath found in the Greek Bible (and in Hebrew in the Dead Sea Scrolls). Orthodox Bibles include it; Catholic and Protestant Bibles do not.","cr":"World English Bible (public domain), from ebible.org","cl":"Chapter","n":["1"]},{"id":"3maccabees","t":"3 Maccabees","g":"Deuterocanon / Apocrypha","f":"lb-apocrypha.json","i":"A story about Jews in Egypt being persecuted by King Ptolemy IV (around 200 BC), written in the first century BC. Used by the Orthodox church; not in Catholic or Protestant Bibles.","cr":"World English Bible (public domain), from ebible.org","cl":"Chapter","n":["1","2","3","4","5","6","7"]},{"id":"4maccabees","t":"4 Maccabees","g":"Deuterocanon / Apocrypha","f":"lb-apocrypha.json","i":"A philosophical speech about reason mastering emotion, using the Maccabean martyrs as examples, written in the first century AD. In an appendix of some Orthodox Bibles; not in Catholic or Protestant Bibles.","cr":"World English Bible (public domain), from ebible.org","cl":"Chapter","n":["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18"]},{"id":"enoch","t":"1 Enoch","g":"Other Jewish writings","f":"lb-jewish.json","i":"Jewish writings from about 300 BC to the first century BC about Enoch, the Watchers (fallen angels), visions of heaven and the final judgment. Jude 14-15 quotes it. Only the Ethiopian Orthodox Church counts it as Scripture; other churches rejected it.","cr":"Translated by R. H. Charles (SPCK, 1917), public domain; text from Wikisource. Charles's editorial brackets and marks are removed.","cl":"Chapter","n":["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30","31","32","33","34","35","36","37","38","39","40","41","42","43","44","45","46","47","48","49","50","51","52","53","54","55","56","57","58","59","60","61","62","63","64","65","66","67","68","69","70","71","72","73","74","75","76","77","78","79","80","81","82","83","84","85","86","87","88","89","90","91","92","93","94","95","96","97","98","99","100","101","102","103","104","105","106","107","108"]},{"id":"jubilees","t":"Jubilees","g":"Other Jewish writings","f":"lb-jewish.json","i":"A retelling of Genesis and early Exodus, given to Moses by an angel and arranged in 49-year 'jubilees', written around 160-150 BC. The Ethiopian Orthodox Church counts it as Scripture; other churches do not.","cr":"Translated by R. H. Charles, in The Apocrypha and Pseudepigrapha of the Old Testament (Oxford, 1913), public domain; text from pseudepigrapha.com.","cl":"Chapter","n":["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30","31","32","33","34","35","36","37","38","39","40","41","42","43","44","45","46","47","48","49","50"]},{"id":"testaments12","t":"Testaments of the Twelve Patriarchs","g":"Other Jewish writings","f":"lb-jewish.json","i":"Last words of each of Jacob's twelve sons to their children, mostly about virtues and vices. Jewish in origin (around the second century BC) with later Christian additions. No church counts it as Scripture.","cr":"From the Ante-Nicene Fathers, vol. 8 (1886), edited by A. Roberts and J. Donaldson, public domain; text via newadvent.org.","cl":"Testament","n":["Reuben","Simeon","Levi","Judah","Issachar","Zebulun","Dan","Naphtali","Gad","Asher","Joseph","Benjamin"]},{"id":"didache","t":"Didache (Teaching of the Twelve Apostles)","g":"Early church writings","f":"lb-church.json","i":"A short early Christian handbook on living as a believer, baptism, the Lord's Supper and church leaders, from about AD 50-120. Some early churches read it, but it was not accepted into the New Testament.","cr":"Translated by J. B. Lightfoot, The Apostolic Fathers (1891), public domain; text from earlychristianwritings.com.","cl":"Chapter","n":["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16"]},{"id":"1clement","t":"1 Clement","g":"Early church writings","f":"lb-church.json","i":"A letter from the church in Rome to the church in Corinth, written around AD 96 and traditionally credited to Clement of Rome. It was read in some churches and copied in Codex Alexandrinus, but not accepted as Scripture.","cr":"Translated by J. B. Lightfoot, The Apostolic Fathers (1891), public domain; text from earlychristianwritings.com.","cl":"Chapter","n":["Greeting","1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30","31","32","33","34","35","36","37","38","39","40","41","42","43","44","45","46","47","48","49","50","51","52","53","54","55","56","57","58","59","60","61","62","63","64","65"]},{"id":"2clement","t":"2 Clement","g":"Early church writings","f":"lb-church.json","i":"An early Christian sermon from around AD 100-150, not actually by Clement. Copied with 1 Clement in Codex Alexandrinus, but not accepted into the New Testament.","cr":"Translated by J. B. Lightfoot, The Apostolic Fathers (1891), public domain; text from earlychristianwritings.com.","cl":"Chapter","n":["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20"]},{"id":"barnabas","t":"Epistle of Barnabas","g":"Early church writings","f":"lb-church.json","i":"A letter from around AD 70-135 that reads the Old Testament as pointing to Christ. It is in Codex Sinaiticus, but the church did not accept it as Scripture, and it was not written by Paul's companion Barnabas.","cr":"Translated by J. B. Lightfoot, The Apostolic Fathers (1891), public domain; text from earlychristianwritings.com.","cl":"Chapter","n":["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21"]},{"id":"hermas","t":"Shepherd of Hermas","g":"Early church writings","f":"lb-church.json","i":"Visions, commandments and parables given to a Christian named Hermas in Rome, written around AD 100-150. It was very popular and is in Codex Sinaiticus, but the early church decided it was not Scripture.","cr":"Translated by J. B. Lightfoot, The Apostolic Fathers (1891), public domain; text from earlychristianwritings.com.","cl":"Section","n":["Vision 1.1","Vision 1.2","Vision 1.3","Vision 1.4","Vision 2.1","Vision 2.2","Vision 2.3","Vision 2.4","Vision 3.1","Vision 3.2","Vision 3.3","Vision 3.4","Vision 3.5","Vision 3.7","Vision 3.8","Vision 3.9","Vision 3.10","Vision 3.11","Vision 3.12","Vision 3.13","Vision 4.1","Vision 4.2","Vision 4.3","Vision 5.5","Mandate 1.1","Mandate 2.1","Mandate 3.1","Mandate 4.1","Mandate 4.2","Mandate 4.3","Mandate 4.4","Mandate 5.1","Mandate 5.2","Mandate 6.1","Mandate 6.2","Mandate 7.1","Mandate 8.1","Mandate 9.1","Mandate 10.1","Mandate 10.2","Mandate 10.3","Mandate 11.1","Mandate 12.1","Mandate 12.2","Mandate 12.3","Mandate 12.4","Mandate 12.5","Mandate 12.6","Parable 1.1","Parable 2.1","Parable 3.1","Parable 4.1","Parable 5.1","Parable 5.2","Parable 5.3","Parable 5.4","Parable 5.5","Parable 5.6","Parable 5.7","Parable 6.1","Parable 6.2","Parable 6.3","Parable 6.5","Parable 7.1","Parable 8.1","Parable 8.2","Parable 8.3","Parable 8.4","Parable 8.5","Parable 8.6","Parable 8.7","Parable 8.8","Parable 8.9","Parable 8.10","Parable 8.11","Parable 9.1","Parable 9.2","Parable 9.3","Parable 9.4","Parable 9.5","Parable 9.6","Parable 9.7","Parable 9.8","Parable 9.9","Parable 9.10","Parable 9.11","Parable 9.12","Parable 9.13","Parable 9.15","Parable 9.17","Parable 9.18","Parable 9.19","Parable 9.20","Parable 9.22","Parable 9.23","Parable 9.24","Parable 9.25","Parable 9.26","Parable 9.27","Parable 9.32","Parable 9.33","Parable 10.1","Parable 10.2","Parable 10.3","Parable 10.4"]},{"id":"ignatius-ephesians","t":"Ignatius to the Ephesians","g":"Early church writings","f":"lb-church.json","i":"One of seven letters Ignatius, bishop of Antioch, wrote around AD 110 on his way to be martyred in Rome. Valued by the early church as a witness, but never counted as Scripture.","cr":"Translated by J. B. Lightfoot, The Apostolic Fathers (1891), public domain; text from earlychristianwritings.com.","cl":"Chapter","n":["Greeting","1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21"]},{"id":"ignatius-magnesians","t":"Ignatius to the Magnesians","g":"Early church writings","f":"lb-church.json","i":"One of seven letters Ignatius, bishop of Antioch, wrote around AD 110 on his way to be martyred in Rome. Valued by the early church as a witness, but never counted as Scripture.","cr":"Translated by J. B. Lightfoot, The Apostolic Fathers (1891), public domain; text from earlychristianwritings.com.","cl":"Chapter","n":["Greeting","1","2","3","4","5","6","7","8","9","10","11","12","13","14","15"]},{"id":"ignatius-trallians","t":"Ignatius to the Trallians","g":"Early church writings","f":"lb-church.json","i":"One of seven letters Ignatius, bishop of Antioch, wrote around AD 110 on his way to be martyred in Rome. Valued by the early church as a witness, but never counted as Scripture.","cr":"Translated by J. B. Lightfoot, The Apostolic Fathers (1891), public domain; text from earlychristianwritings.com.","cl":"Chapter","n":["Greeting","1","2","3","4","5","6","7","8","9","10","11","12","13"]},{"id":"ignatius-romans","t":"Ignatius to the Romans","g":"Early church writings","f":"lb-church.json","i":"One of seven letters Ignatius, bishop of Antioch, wrote around AD 110 on his way to be martyred in Rome. Valued by the early church as a witness, but never counted as Scripture.","cr":"Translated by J. B. Lightfoot, The Apostolic Fathers (1891), public domain; text from earlychristianwritings.com.","cl":"Chapter","n":["Greeting","1","2","3","4","5","6","7","8","9","10"]},{"id":"ignatius-philadelphians","t":"Ignatius to the Philadelphians","g":"Early church writings","f":"lb-church.json","i":"One of seven letters Ignatius, bishop of Antioch, wrote around AD 110 on his way to be martyred in Rome. Valued by the early church as a witness, but never counted as Scripture.","cr":"Translated by J. B. Lightfoot, The Apostolic Fathers (1891), public domain; text from earlychristianwritings.com.","cl":"Chapter","n":["Greeting","1","2","3","4","5","6","7","8","9","10","11"]},{"id":"ignatius-smyrnaeans","t":"Ignatius to the Smyrnaeans","g":"Early church writings","f":"lb-church.json","i":"One of seven letters Ignatius, bishop of Antioch, wrote around AD 110 on his way to be martyred in Rome. Valued by the early church as a witness, but never counted as Scripture.","cr":"Translated by J. B. Lightfoot, The Apostolic Fathers (1891), public domain; text from earlychristianwritings.com.","cl":"Chapter","n":["Greeting","1","2","3","4","5","6","7","8","9","10","11","12","13"]},{"id":"ignatius-polycarp","t":"Ignatius to Polycarp","g":"Early church writings","f":"lb-church.json","i":"One of seven letters Ignatius, bishop of Antioch, wrote around AD 110 on his way to be martyred in Rome. Valued by the early church as a witness, but never counted as Scripture.","cr":"Translated by J. B. Lightfoot, The Apostolic Fathers (1891), public domain; text from earlychristianwritings.com.","cl":"Chapter","n":["Greeting","1","2","3","4","5","6","7","8"]},{"id":"polycarp","t":"Polycarp to the Philippians","g":"Early church writings","f":"lb-church.json","i":"A letter from Polycarp, bishop of Smyrna and a disciple of the apostle John, written around AD 110-140. Respected, but never counted as Scripture.","cr":"Translated by J. B. Lightfoot, The Apostolic Fathers (1891), public domain; text from earlychristianwritings.com.","cl":"Chapter","n":["Greeting","1","2","3","4","5","6","7","8","9","10","11","12","13","14"]},{"id":"gospelpeter","t":"Gospel of Peter (fragment)","g":"Lost gospels and acts","f":"lb-gospels.json","i":"A fragment about Jesus' trial, death and resurrection, written around AD 150 and found in Egypt in 1886. Bishop Serapion rejected it around AD 200 because some readers used it to teach that Christ only seemed to suffer.","cr":"Translated by J. A. Robinson, From the Ante-Nicene Fathers, vol. 9 (1896), edited by A. Menzies, public domain; text via newadvent.org.","cl":"Section","n":["1","2","3","4","5","6","7","8","9","10","11","12","13","14"]},{"id":"gospeljames","t":"Infancy Gospel of James (Protevangelium)","g":"Lost gospels and acts","f":"lb-gospels.json","i":"Stories about Mary's birth and childhood and Jesus' birth, written around AD 150. Popular in Orthodox and Catholic tradition about Mary, but it was never accepted as Scripture and was condemned in the West around AD 500.","cr":"Translated by A. Walker, From the Ante-Nicene Fathers, vol. 8 (1886), edited by A. Roberts and J. Donaldson, public domain; text via newadvent.org.","cl":"Chapter","n":["Title","1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24"]},{"id":"infancythomas","t":"Infancy Gospel of Thomas","g":"Lost gospels and acts","f":"lb-gospels.json","i":"Legends about Jesus as a boy (ages 5-12), written around AD 150-200. Not the same as the Nag Hammadi 'Gospel of Thomas'. The early church rejected it as fiction.","cr":"First Greek Form, translated by A. Walker, From the Ante-Nicene Fathers, vol. 8 (1886), edited by A. Roberts and J. Donaldson, public domain; text via newadvent.org.","cl":"Chapter","n":["Title","1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19"]},{"id":"paulthecla","t":"Acts of Paul and Thecla","g":"Lost gospels and acts","f":"lb-gospels.json","i":"The story of Thecla, a young woman who follows Paul, from the Acts of Paul written around AD 160-190. Tertullian said a church elder in Asia made it up and lost his office for it. Not Scripture.","cr":"Translated by A. Walker, From the Ante-Nicene Fathers, vol. 8 (1886), edited by A. Roberts and J. Donaldson, public domain; text via newadvent.org.","cl":"Chapter","n":["1"]},{"id":"nicodemus","t":"Gospel of Nicodemus (Acts of Pilate)","g":"Lost gospels and acts","f":"lb-gospels.json","i":"An account of Jesus' trial before Pilate (Part I) and his descent into hell (Part II), written around AD 300-400 from older material. Popular in the Middle Ages; never accepted as Scripture.","cr":"Part I First Greek Form and Part II Greek Form, translated by A. Walker, From the Ante-Nicene Fathers, vol. 8 (1886), edited by A. Roberts and J. Donaldson, public domain; text via newadvent.org.","cl":"Chapter","n":["Prologue","1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","Part II","17","18","19","20","21","22","23","24","25","26","27"]},{"id":"apocpeter","t":"Apocalypse of Peter","g":"Apocalypses","f":"lb-apocalypses.json","i":"A vision of heaven and hell credited to Peter, written around AD 100-150. The Muratorian list (about AD 200) mentions it but says some would not read it in church; it was later left out. This is the Greek fragment found in Egypt.","cr":"Translated by A. Rutherfurd, From the Ante-Nicene Fathers, vol. 9 (1896), edited by A. Menzies, public domain; text via newadvent.org.","cl":"Chapter","n":["1"]},{"id":"apocpaul","t":"Apocalypse of Paul (Vision of Paul)","g":"Apocalypses","f":"lb-apocalypses.json","i":"A tour of heaven and hell claimed to be what Paul saw in 2 Corinthians 12, written around AD 250-400. Augustine called it foolish; the church rejected it, though it was popular in the Middle Ages.","cr":"Translated by A. Rutherfurd, From the Ante-Nicene Fathers, vol. 9 (1896), edited by A. Menzies, public domain; text via newadvent.org.","cl":"Section","n":["Intro","1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30","31","32","33","34","35","36","37","38","39","40","41","42","43","44","45","46","47","48","49","50","51"]}];
  const GROUPS = ["Deuterocanon / Apocrypha", "Other Jewish writings", "Early church writings", "Lost gospels and acts", "Apocalypses"];
  const GROUP_NOTE = {
    "Deuterocanon / Apocrypha": "In Catholic and/or Orthodox Bibles, not in the Hebrew Bible or Protestant Bibles.",
    "Other Jewish writings": "Jewish writings from before and around the time of Jesus. Only the Ethiopian church uses some of them as Scripture.",
    "Early church writings": "Letters and books by early Christians after the apostles. Respected, but not Scripture.",
    "Lost gospels and acts": "Later stories about Jesus, Mary and the apostles. The early church rejected them.",
    "Apocalypses": "Visions of heaven and hell credited to apostles. The early church left them out."
  };
  const SKIPPED = [
    ["Gospel of Thomas (Nag Hammadi)", "No free translation available. It was found in 1945 and every English translation is still under copyright."],
    ["Gospel of Judas", "No free translation available (found in the 1970s, published 2006)."],
    ["Gospel of Philip", "No free translation available (Nag Hammadi, 1945)."],
    ["Gospel of Mary", "No free translation available; the English translations are modern and copyrighted."],
    ["2 Enoch, Apocalypse of Abraham", "Not added yet. Old public domain translations exist, so they can come in a later update."],
    ["Acts of Peter, Acts of John, Letter to the Laodiceans, 3 Corinthians", "Not added yet (the free 1924 translation needs more cleanup). Coming in a later update."]
  ];
  let unlocked = false, lastActive = 0, root = null, view = "", stack = [], pushed = false, cache = {}, timer = 0;

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
  const book = id => BOOKS.find(b => b.id === id);

  async function sha256(text) {
    const data = new TextEncoder().encode(text);
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    }
    return sha256js(data);
  }
  // Fallback for pages without crypto.subtle (plain JS SHA-256).
  function sha256js(bytes) {
    const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    let H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const l = bytes.length, n = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(n); m.set(bytes); m[l] = 0x80;
    const dv = new DataView(m.buffer); dv.setUint32(n - 4, l * 8); dv.setUint32(n - 8, Math.floor(l / 0x20000000));
    const w = new Uint32Array(64), r = (x, s) => (x >>> s) | (x << (32 - s));
    for (let i = 0; i < n; i += 64) {
      for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
      for (let t = 16; t < 64; t++) { const s0 = r(w[t-15],7) ^ r(w[t-15],18) ^ (w[t-15] >>> 3), s1 = r(w[t-2],17) ^ r(w[t-2],19) ^ (w[t-2] >>> 10); w[t] = (w[t-16] + s0 + w[t-7] + s1) >>> 0; }
      let [a, b, c, d, e, f, g, h] = H;
      for (let t = 0; t < 64; t++) {
        const t1 = (h + (r(e,6) ^ r(e,11) ^ r(e,25)) + ((e & f) ^ (~e & g)) + K[t] + w[t]) >>> 0;
        const t2 = ((r(a,2) ^ r(a,13) ^ r(a,22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H = H.map((x, k) => (x + [a, b, c, d, e, f, g, h][k]) >>> 0);
    }
    return H.map(x => x.toString(16).padStart(8, "0")).join("");
  }
  function newSalt() {
    const a = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a); else for (let i = 0; i < 16; i++) a[i] = Math.floor(Math.random() * 256);
    return Array.from(a).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  const hasPasskey = () => !!(ls.get(K_HASH) && ls.get(K_SALT));

  /* ---------- session: stays unlocked until the app goes to the background, closes, or 5 min idle ---------- */
  function lock() { unlocked = false; if (root && root.classList.contains("open") && view !== "lock" && view !== "create") { stack = []; show("lock"); } }
  function touch() { lastActive = Date.now(); }
  document.addEventListener("visibilitychange", () => { if (document.hidden) lock(); });
  window.addEventListener("pagehide", () => lock());
  function startIdle() { clearInterval(timer); timer = setInterval(() => { if (unlocked && Date.now() - lastActive > IDLE_MS) lock(); }, 15000); }

  /* ---------- shell ---------- */
  function build() {
    if (root) return root;
    root = document.createElement("div");
    root.id = "lbRoot"; root.className = "lb-root"; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "Lost Books");
    root.innerHTML = '<div class="lb-top"><button type="button" class="lb-back" aria-label="Back">&larr; Back</button><div class="lb-title">Lost Books</div><button type="button" class="lb-x" aria-label="Close Lost Books">Close</button></div><div class="lb-body"></div>';
    document.body.appendChild(root);
    root.querySelector(".lb-x").onclick = () => close();
    root.querySelector(".lb-back").onclick = () => back();
    ["pointerdown", "keydown", "scroll", "touchstart"].forEach(ev => root.addEventListener(ev, touch, { passive: true, capture: true }));
    window.addEventListener("popstate", () => { if (pushed && root.classList.contains("open")) { pushed = false; if (!back(true)) close(true); else pushState(); } });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && root.classList.contains("open")) back(); });
    return root;
  }
  function pushState() { if (!pushed) { try { history.pushState({ bibleyLostBooks: 1 }, ""); pushed = true; } catch (e) {} } }
  const body = () => root.querySelector(".lb-body");
  function setTitle(t) { root.querySelector(".lb-title").textContent = t; }

  function open() {
    build(); root.classList.add("open"); document.documentElement.classList.add("lb-noscroll"); pushState(); startIdle();
    if (unlocked && Date.now() - lastActive > IDLE_MS) unlocked = false;
    stack = [];
    if (!hasPasskey()) show("create"); else if (!unlocked) show("lock"); else show("library");
    touch();
  }
  function close(fromPop) {
    if (!root) return;
    root.classList.remove("open"); document.documentElement.classList.remove("lb-noscroll");
    body().innerHTML = ""; view = ""; stack = [];
    if (pushed && !fromPop) { pushed = false; try { history.back(); } catch (e) {} }
  }
  // returns false when there is nothing to go back to (then the section closes)
  function back(fromPop) {
    if (view === "lock" || view === "create" || view === "warning" || view === "library" || !stack.length) { if (!fromPop) close(); return false; }
    const prev = stack.pop(); show(prev.v, prev.a, true); return true;
  }
  function show(v, a, isBack) {
    if (!isBack && view && view !== v && ["library", "group", "book", "read", "info"].includes(view) && ["group", "book", "read", "info"].includes(v)) stack.push({ v: view, a: curArgs });
    view = v; curArgs = a || {};
    const b = body(); b.scrollTop = 0;
    root.querySelector(".lb-back").style.visibility = (v === "lock" || v === "create" || v === "warning") ? "hidden" : "visible";
    ({ create: vCreate, lock: vLock, warning: vWarning, library: vLibrary, book: vBook, read: vRead, info: vInfo })[v](b, curArgs);
  }
  let curArgs = {};

  /* ---------- create passkey (first time, or after Forgot) ---------- */
  function vCreate(b) {
    setTitle("Lost Books");
    b.innerHTML = '<div class="lb-card lb-center"><div class="lb-lockico" aria-hidden="true">&#128274;</div><h2>Create your passkey</h2>' +
      '<p class="lb-dim">This section is locked. Make a passkey (at least 4 characters). You will type it every time you open Lost Books.</p>' +
      '<form class="lb-form" autocomplete="off"><input type="password" class="lb-in" id="lbP1" placeholder="New passkey" autocomplete="new-password" minlength="4" />' +
      '<input type="password" class="lb-in" id="lbP2" placeholder="Type it again" autocomplete="new-password" minlength="4" />' +
      '<label class="lb-show"><input type="checkbox" id="lbShow" /> Show passkey</label><div class="lb-err" role="alert"></div>' +
      '<button type="submit" class="lb-btn primary">Create passkey</button></form>' +
      '<p class="lb-fine">This is a privacy lock for this app on this phone. The passkey is saved only as a scrambled code (hash), never as plain text.</p></div>';
    const f = b.querySelector("form"), err = b.querySelector(".lb-err");
    b.querySelector("#lbShow").onchange = e => { b.querySelectorAll(".lb-in").forEach(i => i.type = e.target.checked ? "text" : "password"); };
    f.onsubmit = async e => {
      e.preventDefault();
      const p1 = b.querySelector("#lbP1").value, p2 = b.querySelector("#lbP2").value;
      if (p1.length < 4) { err.textContent = "Use at least 4 characters."; return; }
      if (p1 !== p2) { err.textContent = "The two passkeys don't match. Try again."; b.querySelector("#lbP2").value = ""; b.querySelector("#lbP2").focus(); return; }
      const salt = newSalt(), hash = await sha256(salt + ":" + p1);
      ls.set(K_SALT, salt); ls.set(K_HASH, hash);
      unlocked = true; touch(); show("warning");
    };
    setTimeout(() => { const i = b.querySelector("#lbP1"); if (i) i.focus(); }, 250);
  }

  /* ---------- enter passkey ---------- */
  let tries = 0, waitUntil = 0;
  function vLock(b) {
    setTitle("Lost Books");
    b.innerHTML = '<div class="lb-card lb-center"><div class="lb-lockico" aria-hidden="true">&#128274;</div><h2>Locked</h2><p class="lb-dim">Enter your passkey to open Lost Books.</p>' +
      '<form class="lb-form" autocomplete="off"><input type="password" class="lb-in" id="lbPk" placeholder="Passkey" autocomplete="current-password" />' +
      '<div class="lb-err" role="alert"></div><button type="submit" class="lb-btn primary">Unlock</button></form>' +
      '<button type="button" class="lb-link" id="lbForgot">Forgot passkey?</button></div>';
    const f = b.querySelector("form"), err = b.querySelector(".lb-err"), inp = b.querySelector("#lbPk");
    f.onsubmit = async e => {
      e.preventDefault();
      if (Date.now() < waitUntil) { err.textContent = "Too many tries. Wait a few seconds."; return; }
      const h = await sha256(ls.get(K_SALT) + ":" + inp.value);
      if (h === ls.get(K_HASH)) { tries = 0; unlocked = true; touch(); show("warning"); return; }
      tries++; inp.value = ""; inp.classList.remove("lb-shake"); void inp.offsetWidth; inp.classList.add("lb-shake");
      if (tries >= 5) { waitUntil = Date.now() + 30000; tries = 0; err.textContent = "Wrong passkey. Wait 30 seconds and try again."; }
      else err.textContent = "Wrong passkey. Try again.";
    };
    b.querySelector("#lbForgot").onclick = () => {
      if (confirm("Reset your passkey?\n\nYour old passkey will be erased and you will make a new one. (The books are the same for everyone, so nothing is lost.)")) {
        ls.del(K_HASH); ls.del(K_SALT); unlocked = false; show("create");
      }
    };
    setTimeout(() => { if (inp) inp.focus(); }, 250);
  }

  /* ---------- warning: every time after the passkey ---------- */
  function vWarning(b) {
    setTitle("Lost Books");
    b.innerHTML = '<div class="lb-warn" role="alertdialog" aria-labelledby="lbWarnT"><div class="lb-warnico" aria-hidden="true">!</div><h2 id="lbWarnT">Warning</h2>' +
      '<p><b>These writings are NOT part of the Protestant Bible.</b></p>' +
      '<p>Some of them are accepted by the Catholic, Orthodox or Ethiopian churches. Others were rejected by the early church.</p>' +
      '<p>Some contain ideas that contradict Scripture.</p>' +
      '<p>Read them as history, not as God\'s Word. Test everything against the Bible.</p>' +
      '<p class="lb-verse">&ldquo;Test all things, and hold firmly that which is good.&rdquo; <span>1 Thessalonians 5:21</span></p>' +
      '<button type="button" class="lb-btn primary" id="lbOk">I understand</button><button type="button" class="lb-btn" id="lbNo">Go back</button></div>';
    b.querySelector("#lbOk").onclick = () => { touch(); show("library"); };
    b.querySelector("#lbNo").onclick = () => { unlocked = false; close(); };
  }
  const guard = () => { if (!unlocked) { show(hasPasskey() ? "lock" : "create"); return false; } touch(); return true; };

  /* ---------- library ---------- */
  function vLibrary(b) {
    if (!guard()) return;
    setTitle("Lost Books");
    let last = null; try { last = JSON.parse(ls.get(K_LAST) || "null"); } catch (e) {}
    const lb = last && book(last.id);
    let html = '<div class="lb-intro"><div class="lb-eyebrow">Outside the canon</div><h2>Lost Books</h2><p class="lb-dim">Ancient writings that are not in the Protestant Bible, kept apart from the rest of Bibley.</p>' +
      '<button type="button" class="lb-link" data-info="1">About these books, the lock, and what is missing</button></div>';
    if (lb) html += '<button type="button" class="lb-continue" data-cont="1"><span>Continue reading</span><b>' + esc(lb.t) + " " + esc(lb.n[last.c] || "") + "</b></button>";
    for (const g of GROUPS) {
      const list = BOOKS.filter(x => x.g === g); if (!list.length) continue;
      html += '<section class="lb-group"><h3>' + esc(g) + '</h3><p class="lb-gnote">' + esc(GROUP_NOTE[g] || "") + '</p><div class="lb-blist">' +
        list.map(x => '<button type="button" class="lb-bitem" data-b="' + esc(x.id) + '"><b>' + esc(x.t) + "</b><span>" + x.n.length + " " + (x.n.length === 1 ? "part" : (x.cl === "Chapter" ? "chapters" : "parts")) + "</span></button>").join("") + "</div></section>";
    }
    b.innerHTML = html;
    b.querySelectorAll("[data-b]").forEach(el => el.onclick = () => show("book", { id: el.dataset.b }));
    b.querySelector("[data-info]").onclick = () => show("info");
    const c = b.querySelector("[data-cont]"); if (c) c.onclick = () => show("read", { id: last.id, c: last.c });
  }

  /* ---------- one book: intro + chapter grid ---------- */
  function vBook(b, a) {
    if (!guard()) return;
    const x = book(a.id); if (!x) return show("library", {}, true);
    setTitle(x.t);
    if (x.n.length === 1) { /* single-part book: still show the intro first */ }
    b.innerHTML = '<div class="lb-card"><div class="lb-eyebrow">' + esc(x.g) + '</div><h2>' + esc(x.t) + '</h2><p>' + esc(x.i) + '</p><p class="lb-credit">' + esc(x.cr) + "</p></div>" +
      '<div class="lb-chhead">' + (x.n.length === 1 ? "" : esc(x.cl === "Chapter" ? "Chapters" : "Parts")) + "</div>" +
      (x.n.length === 1 ? '<button type="button" class="lb-btn primary" data-c="0">Start reading</button>' :
        '<div class="lb-grid' + (x.n.some(n => n.length > 4) ? " wide" : "") + '">' + x.n.map((n, i) => '<button type="button" data-c="' + i + '">' + esc(n) + "</button>").join("") + "</div>");
    b.querySelectorAll("[data-c]").forEach(el => el.onclick = () => show("read", { id: x.id, c: +el.dataset.c }));
  }

  async function loadFile(f) {
    if (cache[f]) return cache[f];
    const r = await fetch(f, { cache: "no-cache" }).catch(() => fetch(f));
    if (!r || !r.ok) throw new Error("load");
    cache[f] = await r.json(); return cache[f];
  }

  /* ---------- reader ---------- */
  function vRead(b, a) {
    if (!guard()) return;
    const x = book(a.id); if (!x) return show("library", {}, true);
    const ci = Math.max(0, Math.min(a.c | 0, x.n.length - 1));
    const label = x.n.length === 1 ? x.t : x.t + " " + x.n[ci];
    setTitle(label);
    b.innerHTML = '<div class="lb-loading">Loading...</div>';
    loadFile(x.f).then(data => {
      if (view !== "read" || curArgs.id !== x.id || (curArgs.c | 0) !== ci) return;
      const ch = (data[x.id] || [])[ci]; if (!ch) { b.innerHTML = '<div class="lb-card">This part could not be found.</div>'; return; }
      ls.set(K_LAST, JSON.stringify({ id: x.id, c: ci }));
      const size = +(ls.get(K_SIZE) || 0) || 0;
      const one = ch.v.length === 1;
      let html = '<div class="lb-rtools"><span class="lb-tag">Outside the canon</span><span class="lb-sz"><button type="button" data-sz="-1" aria-label="Smaller text">A-</button><button type="button" data-sz="1" aria-label="Bigger text">A+</button></span></div>' +
        '<h2 class="lb-rh">' + esc(label) + "</h2>" + (ch.h ? '<p class="lb-sub">' + esc(ch.h) + "</p>" : "") + (ch.pre ? '<p class="lb-pre">' + esc(ch.pre) + "</p>" : "") +
        '<div class="lb-text" style="font-size:' + (19 + size * 2) + 'px">' + ch.v.map(v => (one ? "" : '<sup>' + esc(v[0]) + "</sup>") + esc(v[1]) + " ").join(one ? "" : "") + "</div>" +
        '<p class="lb-credit small">' + esc(x.cr) + "</p>" +
        '<div class="lb-pager"><button type="button" class="lb-btn" data-go="-1"' + (ci === 0 ? " disabled" : "") + '>Prev</button><button type="button" class="lb-btn" data-go="list">' + (x.n.length === 1 ? "About" : "Chapters") + '</button><button type="button" class="lb-btn" data-go="1"' + (ci >= x.n.length - 1 ? " disabled" : "") + ">Next</button></div>";
      b.innerHTML = html;
      // separate paragraphs for prose books that mark each paragraph as a verse
      b.querySelectorAll("[data-go]").forEach(el => el.onclick = () => {
        const g = el.dataset.go;
        if (g === "list") { back(); return; }
        const n = ci + (+g); if (n < 0 || n >= x.n.length) return;
        curArgs = { id: x.id, c: n }; vRead(b, curArgs); b.scrollTop = 0;
      });
      b.querySelectorAll("[data-sz]").forEach(el => el.onclick = () => {
        const s = Math.max(-2, Math.min(4, size + (+el.dataset.sz))); ls.set(K_SIZE, String(s)); vRead(b, curArgs);
      });
    }).catch(() => { b.innerHTML = '<div class="lb-card lb-center"><p>Could not load this book. Check your connection and try again.</p><button type="button" class="lb-btn" id="lbRetry">Try again</button></div>'; const r = b.querySelector("#lbRetry"); if (r) r.onclick = () => vRead(b, a); });
  }

  /* ---------- about ---------- */
  function vInfo(b) {
    if (!guard()) return;
    setTitle("About Lost Books");
    b.innerHTML = '<div class="lb-card"><h2>About these books</h2><p>These are ancient Jewish and early Christian writings that did not make it into the Protestant Bible. Some are in Catholic, Orthodox or Ethiopian Bibles; others were never accepted by any church. They are here to read as history.</p>' +
      '<p>Every text is a public domain translation (credits are on each book): the World English Bible for the Apocrypha, R. H. Charles (1913, 1917), J. B. Lightfoot (1891) and the Ante-Nicene Fathers (1886-1896).</p></div>' +
      '<div class="lb-card"><h3>Not included</h3><ul class="lb-skip">' + SKIPPED.map(s => "<li><b>" + esc(s[0]) + "</b><span>" + esc(s[1]) + "</span></li>").join("") + "</ul></div>" +
      '<div class="lb-card"><h3>About the lock</h3><p>The passkey is a privacy lock for this app on this phone, not encryption. It is saved only as a scrambled code (salted SHA-256 hash). Lost Books locks again when you leave the app or after 5 minutes without using it. If you forget the passkey, tap "Forgot passkey?" to make a new one.</p>' +
      '<button type="button" class="lb-btn" id="lbLockNow">Lock now</button> <button type="button" class="lb-btn" id="lbChange">Change passkey</button></div>';
    b.querySelector("#lbLockNow").onclick = () => { unlocked = false; close(); };
    b.querySelector("#lbChange").onclick = () => { if (confirm("Make a new passkey now?")) { ls.del(K_HASH); ls.del(K_SALT); unlocked = false; stack = []; show("create"); } };
  }

  /* ---------- entry point: its own button in the drawer, apart from the Bible books ---------- */
  (function () { if (!document.querySelector("link[data-lostbooks]")) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "lostbooks.css"; l.dataset.lostbooks = "1"; document.head.appendChild(l); } })();
  function addEntry() {
    const drawer = document.getElementById("drawer"); if (!drawer || document.getElementById("lbDrawerBtn")) return;
    const wrap = document.createElement("div"); wrap.className = "lb-entry-wrap";
    wrap.innerHTML = '<button type="button" id="lbDrawerBtn" class="lb-entry"><span class="lb-entry-ico" aria-hidden="true">&#128274;</span><span><b>Lost Books</b><small>Outside the canon &middot; locked</small></span></button>';
    const head = drawer.querySelector(".drawer-head");
    if (head && head.nextSibling) drawer.insertBefore(wrap, head.nextSibling); else drawer.appendChild(wrap);
    wrap.querySelector("button").onclick = () => {
      const cb = document.getElementById("closeNavBtn"); if (cb) cb.click();
      setTimeout(open, 60);
    };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addEntry); else addEntry();
  window.BibleyLostBooks = { open, close, lock: () => { unlocked = false; } };
})();
