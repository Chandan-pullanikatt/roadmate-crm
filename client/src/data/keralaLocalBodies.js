// Kerala local body data organized by district → region type → names
// Sources: Kerala State Election Commission & Local Self Government Department

const KERALA_LOCAL_BODIES = {
  Alappuzha: {
    Panchayat: [
      'Alappuzha', 'Ambalappuzha North', 'Ambalappuzha South', 'Aroor', 'Arookutty',
      'Bharanikavu', 'Budhanoor', 'Champakulam', 'Chengannur', 'Chennithala',
      'Cheppad', 'Cheruthana', 'Chettikulangara', 'Edathua', 'Ennakkad',
      'Harippad', 'Kandalloor', 'Kanjikuzhy', 'Karuvatta', 'Kavalam',
      'Kodamthuruthu', 'Krishnapuram', 'Kuthiyathode', 'Mancombu', 'Mavelikkara',
      'Muhamma', 'Muttar', 'Neelamperoor', 'Nedumudy', 'Njallani',
      'Pallippad', 'Pattanakkad', 'Perumbalam', 'Puliyoor', 'Punnapra North',
      'Punnapra South', 'Purakkad', 'Ramankary', 'Thakazhy', 'Thalavady',
      'Thanneermukkom', 'Thrikkunnappuzha', 'Thuravoor', 'Vayalar', 'Veeyapuram',
      'Veliyanad', 'Venduruthi', 'Zyapuram'
    ],
    Municipality: ['Alappuzha', 'Chengannur', 'Harippad', 'Kayamkulam', 'Mavelikkara'],
    Corporation: []
  },
  Ernakulam: {
    Panchayat: [
      'Aikkaranad', 'Alangad', 'Aluva', 'Amballoor', 'Angamaly',
      'Avoly', 'Ayyampuzha', 'Chendamangalam', 'Cheranalloor', 'Chottanikkara',
      'Edakkattuvayal', 'Edavanakkad', 'Elamkunnapuzha', 'Eloor', 'Ezhikkara',
      'Gothuruth', 'Kadungalloor', 'Kalady', 'Kalamassery', 'Kanjoor',
      'Karumalloor', 'Keerampara', 'Keezhmad', 'Kochi', 'Kodanad',
      'Koothattukulam', 'Kothamangalam', 'Kunnathunadu', 'Kuruppampady', 'Kuttampuzha',
      'Manjalloor', 'Manjapra', 'Maradu', 'Mazhuvannoor', 'Mudakuzha',
      'Mulavukad', 'Muvattupuzha', 'Nayarambalam', 'Njarakkal', 'Okkal',
      'Paingottoor', 'Pallippuram', 'Pambakkuda', 'Parakkadavu', 'Paravur',
      'Payamkkulam', 'Pindimana', 'Piravam', 'Pothanikkad', 'Puthenvelikkara',
      'Ramamangalam', 'Rayamangalam', 'Sreemoolanagaram', 'Thirumarady', 'Thiruvaniyoor',
      'Thuravoor', 'Thykoodam', 'Udayamperoor', 'Varapuzha', 'Varappuzha',
      'Vengola', 'Vengoor', 'Vypeen'
    ],
    Municipality: ['Aluva', 'Angamaly', 'Kalamassery', 'Kothamangalam', 'Kunnathunadu', 'Muvattupuzha', 'North Paravur', 'Perumbavoor', 'Thrippunithura'],
    Corporation: ['Kochi']
  },
  Idukki: {
    Panchayat: [
      'Adimali', 'Arakkulam', 'Ariankavu', 'Azhutha', 'Bison Valley',
      'Bysonvalley', 'Chellarkovil', 'Chinnakanal', 'Devikulam', 'Edavetty',
      'Elappara', 'Erattayar', 'Idukki', 'Irumbupalam', 'Kamakshy',
      'Kanjikkuzhy', 'Karimannoor', 'Karunapuram', 'Kattappana', 'Kokkayar',
      'Kumaramangalam', 'Kumily', 'Mankulam', 'Marayoor', 'Mariyapuram',
      'Munnar', 'Nedumkandam', 'Pampadumpara', 'Peermedu', 'Puliyanmala',
      'Rajakkadu', 'Santhanpara', 'Senapathy', 'Thodupuzha', 'Udumbannoor',
      'Upputhara', 'Vathikudy', 'Vellathooval', 'Velliyamattom'
    ],
    Municipality: ['Kattappana', 'Thodupuzha'],
    Corporation: []
  },
  Kannur: {
    Panchayat: [
      'Azhikode', 'Cherupuzha', 'Chirakkal', 'Edakkad', 'Eramam-Kuttoor',
      'Eruvessi', 'Irikkur', 'Iritty', 'Kadachira', 'Kalliassery',
      'Kankol-Alappadamba', 'Kannur', 'Kannapuram', 'Kasaragod', 'Kelakam',
      'Kunhimangalam', 'Kunnothparamba', 'Kurumathoor', 'Malappattam', 'Mangattidamthai',
      'Mattannur', 'Morazha', 'Muzhappilangad', 'Narath', 'Pappinisseri',
      'Pariyaram', 'Pattiam', 'Payyannur', 'Peravoor', 'Ramanthali',
      'Sreekandapuram', 'Taliparamba', 'Thillankery', 'Thrichambaram', 'Ulikkal',
      'Valapattanam', 'Vengad', 'Villiappally'
    ],
    Municipality: ['Iritty', 'Kannur', 'Mattannur', 'Payyannur', 'Sreekandapuram', 'Taliparamba'],
    Corporation: ['Kannur']
  },
  Kasaragod: {
    Panchayat: [
      'Ajanur', 'Badiyadka', 'Bedaduka', 'Bellur', 'Chemnad',
      'Chengala', 'Cheruvathur', 'Delampady', 'Enmakaje', 'Hosdurg',
      'Karadka', 'Kumbla', 'Kunnathukal', 'Kuttikkol', 'Madhur',
      'Mangalpady', 'Meenja', 'Mogral Puthur', 'Mulleria', 'Naimarmoola',
      'Nileswaram', 'Padne', 'Panathady', 'Pilicode', 'Pullur-Periya',
      'Rajapuram', 'Sheni', 'Thekkil', 'Trikaripur', 'Uduma',
      'Valiyaparamba', 'Vorkady'
    ],
    Municipality: ['Hosdurg', 'Kasaragod', 'Kanhangad'],
    Corporation: []
  },
  Kollam: {
    Panchayat: [
      'Adichanalloor', 'Alappad', 'Anchal', 'Chavara', 'Clappana',
      'Chadayamangalam', 'Elamadu', 'Elampalloor', 'Ittiva', 'Karunagappally',
      'Kottamkara', 'Kulakkada', 'Kulasekharapuram', 'Kummil', 'Kunnathur',
      'Maikavu', 'Mayyanad', 'Mukhathala', 'Munroe Thuruthu', 'Neduvathoor',
      'Neendakara', 'Nilamel', 'Oachira', 'Paravur', 'Perayam',
      'Perinad', 'Poothakkulam', 'Poruvazhy', 'Punalur', 'Sooranad North',
      'Sooranad South', 'Thodiyoor', 'Trikkaruva', 'Velinalloor', 'Villukuri'
    ],
    Municipality: ['Chathannoor', 'Karunagappally', 'Kottarakkara', 'Paravur', 'Punalur'],
    Corporation: ['Kollam']
  },
  Kottayam: {
    Panchayat: [
      'Akalakunnam', 'Ayarkunnam', 'Aymanam', 'Bharananganam', 'Chempu',
      'Chirakkadavu', 'Elikulam', 'Erattupetta', 'Ettumanoor', 'Kadanad',
      'Kadaplamattom', 'Kangazha', 'Kanjirappally', 'Karukachal', 'Kidangoor',
      'Kottayam', 'Kozhuvanal', 'Kumarakom', 'Kuravilangad', 'Marangattupilly',
      'Meenachil', 'Melukav', 'Moonilav', 'Mundakayam', 'Muttambalam',
      'Neendoor', 'Pala', 'Pampady', 'Parathodu', 'Poonjar',
      'Ponkunnam', 'Thalayolaparambu', 'Thidanad', 'Thiruvarpu', 'Udayanapuram',
      'Uzhavoor', 'Vakathanam', 'Vazhoor', 'Vegamon', 'Veliyannoor'
    ],
    Municipality: ['Changanassery', 'Erattupetta', 'Ettumanoor', 'Kanjirappally', 'Kottayam', 'Pala'],
    Corporation: []
  },
  Kozhikode: {
    Panchayat: [
      'Azhiyoor', 'Balussery', 'Chathamangalam', 'Chelannur', 'Chengottakave',
      'Chombala', 'Chorode', 'Edacherry', 'Feroke', 'Karassery',
      'Kattippara', 'Kayanna', 'Koorachundu', 'Kodiyathur', 'Kozhikode',
      'Kunnummal', 'Kunnamangalam', 'Kuttiadi', 'Maruthonkara', 'Mavoor',
      'Moodadi', 'Mukkam', 'Nadapuram', 'Nallalam', 'Narikkuni',
      'Olavanna', 'Omassery', 'Onchiyam', 'Panangad', 'Panniyankara',
      'Perambra', 'Peruvayal', 'Purameri', 'Quilandy', 'Thamarassery',
      'Thiruvambady', 'Thiruvallur', 'Ulliyeri', 'Unnikulam', 'Vadakara'
    ],
    Municipality: ['Beypore', 'Koduvally', 'Koyilandy', 'Mukkom', 'Ramanattukara', 'Thiruvambady', 'Vadakara'],
    Corporation: ['Kozhikode']
  },
  Malappuram: {
    Panchayat: [
      'Angadippuram', 'Areacode', 'Chelembra', 'Edarikkode', 'Edappal',
      'Irimbiliyam', 'Kadampuzha', 'Kalikavu', 'Kalpakanchery', 'Karulai',
      'Kondotty', 'Kuttippuram', 'Malappuram', 'Mampad', 'Mankada',
      'Manjeri', 'Marakkara', 'Melmuri', 'Morayur', 'Munderi',
      'Nilambur', 'Othukkungal', 'Palghat', 'Pandikkad', 'Parappanangadi',
      'Perimbanadu', 'Perinthalmanna', 'Peruvallur', 'Ponmala', 'Ponnani',
      'Pulamanthol', 'Purathur', 'Tanur', 'Tirur', 'Tirurangadi',
      'Triprangode', 'Vazhayur', 'Vengara', 'Veettathur'
    ],
    Municipality: ['Kondotty', 'Kottakkal', 'Malappuram', 'Manjeri', 'Nilambur', 'Parappanangadi', 'Perinthalmanna', 'Ponnani', 'Tanur', 'Tirur', 'Tirurangadi', 'Vengara'],
    Corporation: []
  },
  Palakkad: {
    Panchayat: [
      'Agali', 'Akathethara', 'Alathur', 'Ambalapara', 'Ayilur',
      'Cherpulassery', 'Chittur', 'Elavanchery', 'Eruthenpathy', 'Kadampazhipuram',
      'Kalladikode', 'Kannadi', 'Karimba', 'Keralassery', 'Kollengode',
      'Koppam', 'Kottekkad', 'Kuzhalmannam', 'Malampuzha', 'Mannarkkad',
      'Mannur', 'Melarcode', 'Muthalamada', 'Nemmara', 'Nelliyampathy',
      'Ottapalam', 'Pallassana', 'Parambikulam', 'Parali', 'Pattambi',
      'Pirayiri', 'Pudunagaram', 'Shornur', 'Sreekrishnapuram', 'Tarur',
      'Thachampara', 'Thenkurissi', 'Thriuvizha', 'Thrithala', 'Vaniyamkulam',
      'Vellinezhi', 'Vilayur'
    ],
    Municipality: ['Cherpulassery', 'Kollengode', 'Mannarkkad', 'Ottapalam', 'Palakkad', 'Pattambi', 'Shornur'],
    Corporation: ['Palakkad']
  },
  Pathanamthitta: {
    Panchayat: [
      'Aranmula', 'Aruvapulam', 'Chittar', 'Eraviperoor', 'Ezhamkulam',
      'Kalanjoor', 'Kadampanadu', 'Kaviyoor', 'Kodumon', 'Konni',
      'Kozhencherry', 'Kulanada', 'Kunnamthanam', 'Mallappally', 'Mezhuveli',
      'Mylapra', 'Naranganam', 'Nedumpuram', 'Niranam', 'Omalloor',
      'Pandalam', 'Peringara', 'Puramattom', 'Ranni', 'Seethathode',
      'Thannithode', 'Thazhuthala', 'Thumpamon', 'Vechoochira', 'Vallicode'
    ],
    Municipality: ['Adoor', 'Konni', 'Pandalam', 'Pathanamthitta', 'Thiruvalla'],
    Corporation: []
  },
  Thiruvananthapuram: {
    Panchayat: [
      'Anchuthengu', 'Andoorkonam', 'Aruvikkara', 'Athiyanoor', 'Azhoor',
      'Balaramapuram', 'Chenkal', 'Chirayinkil', 'Edava', 'Elakamon',
      'Kallambalam', 'Kallara', 'Karakulam', 'Karette', 'Karumkulam',
      'Kazhakuttom', 'Kilimanoor', 'Kottukal', 'Kudappanamoodu', 'Kunnathukal',
      'Maranalloor', 'Maduvanmoola', 'Madavoor', 'Manamboor', 'Mangalapuram',
      'Manickal', 'Meeyyanoor', 'Mudakkal', 'Mulavilam', 'Mylamoodu',
      'Nagaroor', 'Navaikulam', 'Nedumangad', 'Neyyattinkara', 'Ottasekharamangalam',
      'Panavoor', 'Pallickal', 'Parassala', 'Parippally', 'Peyad',
      'Plamoodu', 'Pullampara', 'Purakkad', 'Thiruvananthapuram', 'Thrikkunnapuzha',
      'Uzhamalakkal', 'Vamanapuram', 'Vellanad', 'Vembayam', 'Vilavoorkal'
    ],
    Municipality: ['Attingal', 'Chirayinkeezhu', 'Nedumangad', 'Neyyattinkara', 'Varkala'],
    Corporation: ['Thiruvananthapuram']
  },
  Thrissur: {
    Panchayat: [
      'Adat', 'Ammadam', 'Anamangad', 'Anthikkad', 'Avanoor',
      'Chelakkara', 'Cherpu', 'Choondal', 'Engandiyoor', 'Erumapetty',
      'Kadavallur', 'Kadukutty', 'Kallur', 'Karumathra', 'Katoor',
      'Kolazhy', 'Kondazhy', 'Kottappady', 'Kuriachira', 'Mala',
      'Mattathur', 'Minalur', 'Mulamkunnathukavu', 'Mundathikode', 'Nadathara',
      'Nenmanikkara', 'Ollukkara', 'Padiyoor', 'Panjal', 'Pazhayannur',
      'Porkulam', 'Poyya', 'Puthenchira', 'Puthur', 'Thekkumkara',
      'Thiruvilwamala', 'Thrissur', 'Thuneri', 'Vadakkekad', 'Vallachira',
      'Vatanapally', 'Velookkara', 'Vilangan'
    ],
    Municipality: ['Chalakudy', 'Guruvayur', 'Irinjalakuda', 'Kodungallur', 'Kunnamkulam', 'Mala', 'Thrissur', 'Wadakkanchery'],
    Corporation: ['Thrissur']
  },
  Wayanad: {
    Panchayat: [
      'Ambalavayal', 'Appapara', 'Bathery', 'Edavaka', 'Kalpetta',
      'Kaniyambetta', 'Kottathara', 'Mananthavady', 'Meenangadi', 'Mullankolly',
      'Munderi', 'Muttil', 'Nenmeni', 'Noolpuzha', 'Padinharathara',
      'Panamaram', 'Poothadi', 'Poothole', 'Pozhuthana', 'Pulpally',
      'Sulthan Bathery', 'Thariode', 'Thirunelli', 'Thrissiliery', 'Vythiri'
    ],
    Municipality: ['Kalpetta', 'Mananthavady', 'Sulthan Bathery'],
    Corporation: []
  }
};

export default KERALA_LOCAL_BODIES;
