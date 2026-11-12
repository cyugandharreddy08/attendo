/**
 * Comprehensive Indian B.Tech / Engineering Colleges and Branches Database
 * Researched across all NIRF Top Institutions, IITs, NITs, IIITs, State & Deemed Universities.
 */

export interface CollegeInfo {
  name: string;
  shortCode: string;
  city: string;
  state: string;
  category: 'IIT' | 'NIT' | 'IIIT' | 'BITS' | 'Govt' | 'Top Private' | 'University';
}

export const TOP_INDIAN_COLLEGES: CollegeInfo[] = [
  // --- IITs (Indian Institutes of Technology) ---
  { name: 'IIT Bombay - Indian Institute of Technology Bombay', shortCode: 'IITB', city: 'Mumbai', state: 'Maharashtra', category: 'IIT' },
  { name: 'IIT Delhi - Indian Institute of Technology Delhi', shortCode: 'IITD', city: 'New Delhi', state: 'Delhi', category: 'IIT' },
  { name: 'IIT Madras - Indian Institute of Technology Madras', shortCode: 'IITM', city: 'Chennai', state: 'Tamil Nadu', category: 'IIT' },
  { name: 'IIT Kanpur - Indian Institute of Technology Kanpur', shortCode: 'IITK', city: 'Kanpur', state: 'Uttar Pradesh', category: 'IIT' },
  { name: 'IIT Kharagpur - Indian Institute of Technology Kharagpur', shortCode: 'IITKGP', city: 'Kharagpur', state: 'West Bengal', category: 'IIT' },
  { name: 'IIT Roorkee - Indian Institute of Technology Roorkee', shortCode: 'IITR', city: 'Roorkee', state: 'Uttarakhand', category: 'IIT' },
  { name: 'IIT Guwahati - Indian Institute of Technology Guwahati', shortCode: 'IITG', city: 'Guwahati', state: 'Assam', category: 'IIT' },
  { name: 'IIT Hyderabad - Indian Institute of Technology Hyderabad', shortCode: 'IITH', city: 'Hyderabad', state: 'Telangana', category: 'IIT' },
  { name: 'IIT (BHU) Varanasi - Indian Institute of Technology BHU', shortCode: 'IIT-BHU', city: 'Varanasi', state: 'Uttar Pradesh', category: 'IIT' },
  { name: 'IIT (ISM) Dhanbad - Indian Institute of Technology Dhanbad', shortCode: 'IIT-ISM', city: 'Dhanbad', state: 'Jharkhand', category: 'IIT' },
  { name: 'IIT Indore - Indian Institute of Technology Indore', shortCode: 'IITI', city: 'Indore', state: 'Madhya Pradesh', category: 'IIT' },
  { name: 'IIT Ropar - Indian Institute of Technology Ropar', shortCode: 'IIT-RPR', city: 'Rupnagar', state: 'Punjab', category: 'IIT' },
  { name: 'IIT Mandi - Indian Institute of Technology Mandi', shortCode: 'IIT-MND', city: 'Mandi', state: 'Himachal Pradesh', category: 'IIT' },
  { name: 'IIT Gandhinagar - Indian Institute of Technology Gandhinagar', shortCode: 'IITGN', city: 'Gandhinagar', state: 'Gujarat', category: 'IIT' },
  { name: 'IIT Jodhpur - Indian Institute of Technology Jodhpur', shortCode: 'IITJ', city: 'Jodhpur', state: 'Rajasthan', category: 'IIT' },
  { name: 'IIT Patna - Indian Institute of Technology Patna', shortCode: 'IITP', city: 'Patna', state: 'Bihar', category: 'IIT' },
  { name: 'IIT Bhubaneswar - Indian Institute of Technology Bhubaneswar', shortCode: 'IITBBS', city: 'Bhubaneswar', state: 'Odisha', category: 'IIT' },
  { name: 'IIT Tirupati - Indian Institute of Technology Tirupati', shortCode: 'IITTP', city: 'Tirupati', state: 'Andhra Pradesh', category: 'IIT' },
  { name: 'IIT Palakkad - Indian Institute of Technology Palakkad', shortCode: 'IITPKD', city: 'Palakkad', state: 'Kerala', category: 'IIT' },
  { name: 'IIT Dharwad - Indian Institute of Technology Dharwad', shortCode: 'IITDH', city: 'Dharwad', state: 'Karnataka', category: 'IIT' },
  { name: 'IIT Bhilai - Indian Institute of Technology Bhilai', shortCode: 'IIT-BHL', city: 'Bhilai', state: 'Chhattisgarh', category: 'IIT' },
  { name: 'IIT Goa - Indian Institute of Technology Goa', shortCode: 'IITGOA', city: 'Farmagudi', state: 'Goa', category: 'IIT' },
  { name: 'IIT Jammu - Indian Institute of Technology Jammu', shortCode: 'IITJMU', city: 'Jammu', state: 'Jammu & Kashmir', category: 'IIT' },

  // --- NITs (National Institutes of Technology) ---
  { name: 'NIT Trichy - National Institute of Technology Tiruchirappalli', shortCode: 'NITT', city: 'Tiruchirappalli', state: 'Tamil Nadu', category: 'NIT' },
  { name: 'NIT Karnataka - National Institute of Technology Surathkal', shortCode: 'NITK', city: 'Surathkal', state: 'Karnataka', category: 'NIT' },
  { name: 'NIT Rourkela - National Institute of Technology Rourkela', shortCode: 'NITR', city: 'Rourkela', state: 'Odisha', category: 'NIT' },
  { name: 'NIT Warangal - National Institute of Technology Warangal', shortCode: 'NITW', city: 'Warangal', state: 'Telangana', category: 'NIT' },
  { name: 'NIT Calicut - National Institute of Technology Calicut', shortCode: 'NITC', city: 'Kozhikode', state: 'Kerala', category: 'NIT' },
  { name: 'VNIT Nagpur - Visvesvaraya National Institute of Technology', shortCode: 'VNIT', city: 'Nagpur', state: 'Maharashtra', category: 'NIT' },
  { name: 'MNIT Jaipur - Malaviya National Institute of Technology', shortCode: 'MNIT', city: 'Jaipur', state: 'Rajasthan', category: 'NIT' },
  { name: 'MNNIT Allahabad - Motilal Nehru National Institute of Technology', shortCode: 'MNNIT', city: 'Prayagraj', state: 'Uttar Pradesh', category: 'NIT' },
  { name: 'SVNIT Surat - Sardar Vallabhbhai National Institute of Technology', shortCode: 'SVNIT', city: 'Surat', state: 'Gujarat', category: 'NIT' },
  { name: 'NIT Silchar - National Institute of Technology Silchar', shortCode: 'NITS', city: 'Silchar', state: 'Assam', category: 'NIT' },
  { name: 'NIT Durgapur - National Institute of Technology Durgapur', shortCode: 'NITDGP', city: 'Durgapur', state: 'West Bengal', category: 'NIT' },
  { name: 'NIT Jalandhar - Dr. B.R. Ambedkar NIT Jalandhar', shortCode: 'NITJ', city: 'Jalandhar', state: 'Punjab', category: 'NIT' },
  { name: 'NIT Hamirpur - National Institute of Technology Hamirpur', shortCode: 'NITH', city: 'Hamirpur', state: 'Himachal Pradesh', category: 'NIT' },
  { name: 'MANIT Bhopal - Maulana Azad National Institute of Technology', shortCode: 'MANIT', city: 'Bhopal', state: 'Madhya Pradesh', category: 'NIT' },
  { name: 'NIT Kurukshetra - National Institute of Technology Kurukshetra', shortCode: 'NITKKR', city: 'Kurukshetra', state: 'Haryana', category: 'NIT' },
  { name: 'NIT Jamshedpur - National Institute of Technology Jamshedpur', shortCode: 'NITJSR', city: 'Jamshedpur', state: 'Jharkhand', category: 'NIT' },
  { name: 'NIT Patna - National Institute of Technology Patna', shortCode: 'NITP', city: 'Patna', state: 'Bihar', category: 'NIT' },
  { name: 'NIT Raipur - National Institute of Technology Raipur', shortCode: 'NITRR', city: 'Raipur', state: 'Chhattisgarh', category: 'NIT' },
  { name: 'NIT Goa - National Institute of Technology Goa', shortCode: 'NITGOA', city: 'Cuncolim', state: 'Goa', category: 'NIT' },
  { name: 'NIT Srinagar - National Institute of Technology Srinagar', shortCode: 'NITSRI', city: 'Srinagar', state: 'Jammu & Kashmir', category: 'NIT' },
  { name: 'NIT Agartala - National Institute of Technology Agartala', shortCode: 'NITA', city: 'Agartala', state: 'Tripura', category: 'NIT' },
  { name: 'NIT Meghalaya - National Institute of Technology Meghalaya', shortCode: 'NITM', city: 'Shillong', state: 'Meghalaya', category: 'NIT' },
  { name: 'NIT Andhra Pradesh - National Institute of Technology Tadepalligudem', shortCode: 'NITAP', city: 'Tadepalligudem', state: 'Andhra Pradesh', category: 'NIT' },
  { name: 'NIT Puducherry - National Institute of Technology Puducherry', shortCode: 'NITPY', city: 'Karaikal', state: 'Puducherry', category: 'NIT' },
  { name: 'NIT Uttarakhand - National Institute of Technology Uttarakhand', shortCode: 'NITUK', city: 'Srinagar Garhwal', state: 'Uttarakhand', category: 'NIT' },
  { name: 'NIT Manipur - National Institute of Technology Manipur', shortCode: 'NITMN', city: 'Imphal', state: 'Manipur', category: 'NIT' },
  { name: 'NIT Mizoram - National Institute of Technology Mizoram', shortCode: 'NITMZ', city: 'Aizawl', state: 'Mizoram', category: 'NIT' },
  { name: 'NIT Nagaland - National Institute of Technology Nagaland', shortCode: 'NITNL', city: 'Chumukedima', state: 'Nagaland', category: 'NIT' },
  { name: 'NIT Sikkim - National Institute of Technology Sikkim', shortCode: 'NITSKM', city: 'Ravangla', state: 'Sikkim', category: 'NIT' },
  { name: 'NIT Arunachal Pradesh - National Institute of Technology Arunachal', shortCode: 'NITARP', city: 'Jote', state: 'Arunachal Pradesh', category: 'NIT' },
  { name: 'IIEST Shibpur - Indian Institute of Engineering Science and Technology', shortCode: 'IIEST', city: 'Howrah', state: 'West Bengal', category: 'NIT' },

  // --- IIITs (Indian Institutes of Information Technology) ---
  { name: 'IIIT Hyderabad - International Institute of Information Technology', shortCode: 'IIITH', city: 'Hyderabad', state: 'Telangana', category: 'IIIT' },
  { name: 'IIIT Bangalore - International Institute of Information Technology', shortCode: 'IIITB', city: 'Bengaluru', state: 'Karnataka', category: 'IIIT' },
  { name: 'IIIT Delhi - Indraprastha Institute of Information Technology', shortCode: 'IIITD', city: 'New Delhi', state: 'Delhi', category: 'IIIT' },
  { name: 'IIIT Allahabad - Indian Institute of Information Technology', shortCode: 'IIITA', city: 'Prayagraj', state: 'Uttar Pradesh', category: 'IIIT' },
  { name: 'ABV-IIITM Gwalior - Atal Bihari Vajpayee IIITM', shortCode: 'IIITM', city: 'Gwalior', state: 'Madhya Pradesh', category: 'IIIT' },
  { name: 'IIITDM Jabalpur - PDPM Indian Institute of Information Technology', shortCode: 'IIITDMJ', city: 'Jabalpur', state: 'Madhya Pradesh', category: 'IIIT' },
  { name: 'IIITDM Kancheepuram - Design and Manufacturing', shortCode: 'IIITDMK', city: 'Chennai', state: 'Tamil Nadu', category: 'IIIT' },
  { name: 'IIITDM Kurnool - Design and Manufacturing Kurnool', shortCode: 'IIITDM-KNL', city: 'Kurnool', state: 'Andhra Pradesh', category: 'IIIT' },
  { name: 'IIIT Sri City - Indian Institute of Information Technology Sri City', shortCode: 'IIITS', city: 'Sri City', state: 'Andhra Pradesh', category: 'IIIT' },
  { name: 'IIIT Lucknow - Indian Institute of Information Technology Lucknow', shortCode: 'IIITL', city: 'Lucknow', state: 'Uttar Pradesh', category: 'IIIT' },
  { name: 'IIIT Pune - Indian Institute of Information Technology Pune', shortCode: 'IIITP', city: 'Pune', state: 'Maharashtra', category: 'IIIT' },
  { name: 'IIIT Vadodara - Indian Institute of Information Technology Vadodara', shortCode: 'IIITV', city: 'Gandhinagar', state: 'Gujarat', category: 'IIIT' },
  { name: 'IIIT Guwahati - Indian Institute of Information Technology Guwahati', shortCode: 'IIITG', city: 'Guwahati', state: 'Assam', category: 'IIIT' },
  { name: 'IIIT Kota - Indian Institute of Information Technology Kota', shortCode: 'IIIT-KTA', city: 'Kota', state: 'Rajasthan', category: 'IIIT' },
  { name: 'IIIT Nagpur - Indian Institute of Information Technology Nagpur', shortCode: 'IIITN', city: 'Nagpur', state: 'Maharashtra', category: 'IIIT' },
  { name: 'IIIT Surat - Indian Institute of Information Technology Surat', shortCode: 'IIIT-SRT', city: 'Surat', state: 'Gujarat', category: 'IIIT' },
  { name: 'IIIT Bhopal - Indian Institute of Information Technology Bhopal', shortCode: 'IIIT-BPL', city: 'Bhopal', state: 'Madhya Pradesh', category: 'IIIT' },
  { name: 'IIIT Kottayam - Indian Institute of Information Technology Kottayam', shortCode: 'IIITKTY', city: 'Kottayam', state: 'Kerala', category: 'IIIT' },
  { name: 'IIIT Dharwad - Indian Institute of Information Technology Dharwad', shortCode: 'IIITDWD', city: 'Dharwad', state: 'Karnataka', category: 'IIIT' },
  { name: 'IIIT Kalyani - Indian Institute of Information Technology Kalyani', shortCode: 'IIITKL', city: 'Kalyani', state: 'West Bengal', category: 'IIIT' },
  { name: 'IIIT Sonepat - Indian Institute of Information Technology Sonepat', shortCode: 'IIIT-SNP', city: 'Sonepat', state: 'Haryana', category: 'IIIT' },
  { name: 'IIIT Una - Indian Institute of Information Technology Una', shortCode: 'IIITU', city: 'Saloh', state: 'Himachal Pradesh', category: 'IIIT' },
  { name: 'IIIT Ranchi - Indian Institute of Information Technology Ranchi', shortCode: 'IIIT-RCH', city: 'Ranchi', state: 'Jharkhand', category: 'IIIT' },
  { name: 'IIIT Bhagalpur - Indian Institute of Information Technology Bhagalpur', shortCode: 'IIIT-BGP', city: 'Bhagalpur', state: 'Bihar', category: 'IIIT' },
  { name: 'IIIT Raichur - Indian Institute of Information Technology Raichur', shortCode: 'IIIT-RCR', city: 'Raichur', state: 'Karnataka', category: 'IIIT' },

  // --- BITS & Premier Institutes ---
  { name: 'BITS Pilani - Birla Institute of Technology and Science (Pilani Campus)', shortCode: 'BITS-P', city: 'Pilani', state: 'Rajasthan', category: 'BITS' },
  { name: 'BITS Pilani - K.K. Birla Goa Campus', shortCode: 'BITS-Goa', city: 'Vasco da Gama', state: 'Goa', category: 'BITS' },
  { name: 'BITS Pilani - Hyderabad Campus', shortCode: 'BITS-Hyd', city: 'Hyderabad', state: 'Telangana', category: 'BITS' },
  { name: 'DTU - Delhi Technological University', shortCode: 'DTU', city: 'New Delhi', state: 'Delhi', category: 'Govt' },
  { name: 'NSUT - Netaji Subhas University of Technology', shortCode: 'NSUT', city: 'New Delhi', state: 'Delhi', category: 'Govt' },
  { name: 'Jadavpur University (Faculty of Engineering & Technology)', shortCode: 'JU', city: 'Kolkata', state: 'West Bengal', category: 'Govt' },
  { name: 'COEP Technological University (College of Engineering Pune)', shortCode: 'COEP', city: 'Pune', state: 'Maharashtra', category: 'Govt' },
  { name: 'VJTI Mumbai - Veermata Jijabai Technological Institute', shortCode: 'VJTI', city: 'Mumbai', state: 'Maharashtra', category: 'Govt' },
  { name: 'Anna University - College of Engineering Guindy (CEG)', shortCode: 'CEG', city: 'Chennai', state: 'Tamil Nadu', category: 'Govt' },
  { name: 'PSG College of Technology', shortCode: 'PSG-Tech', city: 'Coimbatore', state: 'Tamil Nadu', category: 'Govt' },
  { name: 'RV College of Engineering (RVCE)', shortCode: 'RVCE', city: 'Bengaluru', state: 'Karnataka', category: 'Top Private' },
  { name: 'BMS College of Engineering (BMSCE)', shortCode: 'BMSCE', city: 'Bengaluru', state: 'Karnataka', category: 'Top Private' },
  { name: 'M. S. Ramaiah Institute of Technology (MSRIT)', shortCode: 'MSRIT', city: 'Bengaluru', state: 'Karnataka', category: 'Top Private' },
  { name: 'PES University (Ring Road Campus)', shortCode: 'PESU', city: 'Bengaluru', state: 'Karnataka', category: 'Top Private' },

  // --- Leading Top Private & Deemed Universities ---
  { name: 'VIT Vellore - Vellore Institute of Technology', shortCode: 'VIT-V', city: 'Vellore', state: 'Tamil Nadu', category: 'Top Private' },
  { name: 'VIT Chennai - Vellore Institute of Technology', shortCode: 'VIT-C', city: 'Chennai', state: 'Tamil Nadu', category: 'Top Private' },
  { name: 'VIT-AP University - Vellore Institute of Technology Andhra Pradesh', shortCode: 'VIT-AP', city: 'Amaravati', state: 'Andhra Pradesh', category: 'Top Private' },
  { name: 'VIT Bhopal University', shortCode: 'VIT-B', city: 'Bhopal', state: 'Madhya Pradesh', category: 'Top Private' },
  { name: 'Manipal Institute of Technology (MIT Manipal) - MAHE', shortCode: 'MIT-Manipal', city: 'Manipal', state: 'Karnataka', category: 'Top Private' },
  { name: 'Manipal University Jaipur (MUJ)', shortCode: 'MUJ', city: 'Jaipur', state: 'Rajasthan', category: 'Top Private' },
  { name: 'Thapar Institute of Engineering and Technology (TIET)', shortCode: 'Thapar', city: 'Patiala', state: 'Punjab', category: 'Top Private' },
  { name: 'SRM Institute of Science and Technology (KTR Main Campus)', shortCode: 'SRM-KTR', city: 'Kattankulathur', state: 'Tamil Nadu', category: 'Top Private' },
  { name: 'SRM University AP', shortCode: 'SRM-AP', city: 'Amaravati', state: 'Andhra Pradesh', category: 'Top Private' },
  { name: 'Amrita School of Engineering (Amrita Vishwa Vidyapeetham)', shortCode: 'Amrita', city: 'Coimbatore', state: 'Tamil Nadu', category: 'Top Private' },
  { name: 'SASTRA Deemed University', shortCode: 'SASTRA', city: 'Thanjavur', state: 'Tamil Nadu', category: 'Top Private' },
  { name: 'SSN College of Engineering', shortCode: 'SSN', city: 'Chennai', state: 'Tamil Nadu', category: 'Top Private' },
  { name: 'KIIT Deemed to be University', shortCode: 'KIIT', city: 'Bhubaneswar', state: 'Odisha', category: 'Top Private' },
  { name: 'Siksha O Anusandhan (SOA ITER)', shortCode: 'SOA-ITER', city: 'Bhubaneswar', state: 'Odisha', category: 'Top Private' },
  { name: 'Amity University Noida', shortCode: 'Amity-Noida', city: 'Noida', state: 'Uttar Pradesh', category: 'Top Private' },
  { name: 'Lovely Professional University (LPU)', shortCode: 'LPU', city: 'Phagwara', state: 'Punjab', category: 'Top Private' },
  { name: 'Chandigarh University (CU)', shortCode: 'CU', city: 'Mohali', state: 'Punjab', category: 'Top Private' },
  { name: 'Shiv Nadar University (SNU)', shortCode: 'SNU', city: 'Greater Noida', state: 'Uttar Pradesh', category: 'Top Private' },
  { name: 'Jaypee Institute of Information Technology (JIIT Sector 62)', shortCode: 'JIIT-62', city: 'Noida', state: 'Uttar Pradesh', category: 'Top Private' },
  { name: 'Mahindra University - École Centrale School of Engineering', shortCode: 'MU-Hyd', city: 'Hyderabad', state: 'Telangana', category: 'Top Private' },
  { name: 'DA-IICT - Dhirubhai Ambani Institute of ICT', shortCode: 'DA-IICT', city: 'Gandhinagar', state: 'Gujarat', category: 'Top Private' },
  { name: 'Nirma University - Institute of Technology', shortCode: 'Nirma', city: 'Ahmedabad', state: 'Gujarat', category: 'Top Private' },
  { name: 'Pandit Deendayal Energy University (PDEU)', shortCode: 'PDEU', city: 'Gandhinagar', state: 'Gujarat', category: 'Top Private' },

  // --- Telangana & Andhra Pradesh Top Engineering Colleges ---
  { name: 'CBIT - Chaitanya Bharathi Institute of Technology', shortCode: 'CBIT', city: 'Hyderabad', state: 'Telangana', category: 'Top Private' },
  { name: 'VNR Vignana Jyothi Institute of Engineering and Technology (VNR VJIET)', shortCode: 'VNR-VJIET', city: 'Hyderabad', state: 'Telangana', category: 'Top Private' },
  { name: 'Vasavi College of Engineering', shortCode: 'VCE', city: 'Hyderabad', state: 'Telangana', category: 'Top Private' },
  { name: 'Gokaraju Rangaraju Institute of Engineering and Technology (GRIET)', shortCode: 'GRIET', city: 'Hyderabad', state: 'Telangana', category: 'Top Private' },
  { name: 'CVR College of Engineering', shortCode: 'CVR', city: 'Hyderabad', state: 'Telangana', category: 'Top Private' },
  { name: 'Keshav Memorial Institute of Technology (KMIT)', shortCode: 'KMIT', city: 'Hyderabad', state: 'Telangana', category: 'Top Private' },
  { name: 'Sreenidhi Institute of Science and Technology (SNIST)', shortCode: 'SNIST', city: 'Hyderabad', state: 'Telangana', category: 'Top Private' },
  { name: 'Vardhaman College of Engineering', shortCode: 'Vardhaman', city: 'Hyderabad', state: 'Telangana', category: 'Top Private' },
  { name: 'JNTU College of Engineering Hyderabad (JNTUH CEH)', shortCode: 'JNTUH', city: 'Hyderabad', state: 'Telangana', category: 'Govt' },
  { name: 'Osmania University College of Engineering (OUCE)', shortCode: 'OUCE', city: 'Hyderabad', state: 'Telangana', category: 'Govt' },
  { name: 'Anurag University', shortCode: 'Anurag', city: 'Hyderabad', state: 'Telangana', category: 'Top Private' },
  { name: 'Institute of Aeronautical Engineering (IARE)', shortCode: 'IARE', city: 'Hyderabad', state: 'Telangana', category: 'Top Private' },
  { name: 'BVRIT Hyderabad College of Engineering for Women', shortCode: 'BVRITH', city: 'Hyderabad', state: 'Telangana', category: 'Top Private' },
  { name: 'B.V. Raju Institute of Technology (BVRIT Narsapur)', shortCode: 'BVRIT', city: 'Narsapur', state: 'Telangana', category: 'Top Private' },
  { name: 'Malla Reddy College of Engineering and Technology (MRCET)', shortCode: 'MRCET', city: 'Hyderabad', state: 'Telangana', category: 'Top Private' },
  { name: 'MGIT - Mahatma Gandhi Institute of Technology', shortCode: 'MGIT', city: 'Hyderabad', state: 'Telangana', category: 'Top Private' },
  { name: 'KL Deemed to be University (KLU)', shortCode: 'KLU', city: 'Vijayawada', state: 'Andhra Pradesh', category: 'Top Private' },
  { name: 'Vignan Foundation for Science, Technology & Research (VFSTR)', shortCode: 'Vignan', city: 'Guntur', state: 'Andhra Pradesh', category: 'Top Private' },
  { name: 'Gayatri Vidya Parishad College of Engineering (GVPCE)', shortCode: 'GVPCE', city: 'Visakhapatnam', state: 'Andhra Pradesh', category: 'Top Private' },
  { name: 'RVR & JC College of Engineering', shortCode: 'RVRJC', city: 'Guntur', state: 'Andhra Pradesh', category: 'Top Private' },
  { name: 'Velagapudi Ramakrishna Siddhartha Engineering College (VRSEC)', shortCode: 'VRSEC', city: 'Vijayawada', state: 'Andhra Pradesh', category: 'Top Private' },
  { name: 'Andhra University College of Engineering (AUCE)', shortCode: 'AUCE', city: 'Visakhapatnam', state: 'Andhra Pradesh', category: 'Govt' },
  { name: 'JNTUK University College of Engineering Kakinada', shortCode: 'JNTUK', city: 'Kakinada', state: 'Andhra Pradesh', category: 'Govt' },
  { name: 'JNTUA College of Engineering Anantapur', shortCode: 'JNTUA', city: 'Anantapur', state: 'Andhra Pradesh', category: 'Govt' },
  { name: 'Sree Vidyanikethan Engineering College', shortCode: 'SVEC', city: 'Tirupati', state: 'Andhra Pradesh', category: 'Top Private' },
  { name: 'GMR Institute of Technology (GMRIT)', shortCode: 'GMRIT', city: 'Rajam', state: 'Andhra Pradesh', category: 'Top Private' },

  // --- Maharashtra & Gujarat Top Colleges ---
  { name: 'PICT Pune - Pune Institute of Computer Technology', shortCode: 'PICT', city: 'Pune', state: 'Maharashtra', category: 'Top Private' },
  { name: 'MIT World Peace University (MIT-WPU)', shortCode: 'MIT-WPU', city: 'Pune', state: 'Maharashtra', category: 'Top Private' },
  { name: 'Vishwakarma Institute of Technology (VIT Pune)', shortCode: 'VIT-Pune', city: 'Pune', state: 'Maharashtra', category: 'Top Private' },
  { name: 'SPIT Mumbai - Sardar Patel Institute of Technology', shortCode: 'SPIT', city: 'Mumbai', state: 'Maharashtra', category: 'Top Private' },
  { name: 'D.J. Sanghvi College of Engineering (DJSCE)', shortCode: 'DJSCE', city: 'Mumbai', state: 'Maharashtra', category: 'Top Private' },
  { name: 'K. J. Somaiya College of Engineering', shortCode: 'KJSCE', city: 'Mumbai', state: 'Maharashtra', category: 'Top Private' },
  { name: 'Walchand College of Engineering', shortCode: 'WCE', city: 'Sangli', state: 'Maharashtra', category: 'Govt' },
  { name: 'Mukesh Patel School of Technology (NMIMS MPSTME)', shortCode: 'MPSTME', city: 'Mumbai', state: 'Maharashtra', category: 'Top Private' },
  { name: 'L.D. College of Engineering (LDCE)', shortCode: 'LDCE', city: 'Ahmedabad', state: 'Gujarat', category: 'Govt' },
  { name: 'BVM Engineering College (Birla Vishvakarma Mahavidyalaya)', shortCode: 'BVM', city: 'Anand', state: 'Gujarat', category: 'Govt' },

  // --- Delhi NCR & North India Top Colleges ---
  { name: 'Jamia Millia Islamia (Faculty of Engineering & Technology)', shortCode: 'JMI', city: 'New Delhi', state: 'Delhi', category: 'Govt' },
  { name: 'IGDTUW - Indira Gandhi Delhi Technical University for Women', shortCode: 'IGDTUW', city: 'New Delhi', state: 'Delhi', category: 'Govt' },
  { name: 'MAIT - Maharaja Agrasen Institute of Technology', shortCode: 'MAIT', city: 'New Delhi', state: 'Delhi', category: 'Top Private' },
  { name: 'MSIT - Maharaja Surajmal Institute of Technology', shortCode: 'MSIT', city: 'New Delhi', state: 'Delhi', category: 'Top Private' },
  { name: 'PEC Chandigarh - Punjab Engineering College', shortCode: 'PEC', city: 'Chandigarh', state: 'Punjab', category: 'Govt' },
  { name: 'HBTU Kanpur - Harcourt Butler Technical University', shortCode: 'HBTU', city: 'Kanpur', state: 'Uttar Pradesh', category: 'Govt' },
  { name: 'MMMUT Gorakhpur - Madan Mohan Malaviya University of Tech', shortCode: 'MMMUT', city: 'Gorakhpur', state: 'Uttar Pradesh', category: 'Govt' },
  { name: 'AKGEC Ghaziabad - Ajay Kumar Garg Engineering College', shortCode: 'AKGEC', city: 'Ghaziabad', state: 'Uttar Pradesh', category: 'Top Private' },
  { name: 'KIET Group of Institutions', shortCode: 'KIET', city: 'Ghaziabad', state: 'Uttar Pradesh', category: 'Top Private' },
  { name: 'JSS Academy of Technical Education (JSSATE Noida)', shortCode: 'JSSATE', city: 'Noida', state: 'Uttar Pradesh', category: 'Top Private' },
  { name: 'Galgotias University / College of Engineering & Technology', shortCode: 'Galgotias', city: 'Greater Noida', state: 'Uttar Pradesh', category: 'Top Private' },
  { name: 'Bennett University', shortCode: 'Bennett', city: 'Greater Noida', state: 'Uttar Pradesh', category: 'Top Private' },
  { name: 'ABES Engineering College', shortCode: 'ABES', city: 'Ghaziabad', state: 'Uttar Pradesh', category: 'Top Private' },
  { name: 'YMCA University of Science and Technology (J.C. Bose UST)', shortCode: 'YMCA', city: 'Faridabad', state: 'Haryana', category: 'Govt' },

  // --- West Bengal & East India ---
  { name: 'Heritage Institute of Technology (HIT Kolkata)', shortCode: 'HIT', city: 'Kolkata', state: 'West Bengal', category: 'Top Private' },
  { name: 'IEM Kolkata - Institute of Engineering and Management', shortCode: 'IEM', city: 'Kolkata', state: 'West Bengal', category: 'Top Private' },
  { name: 'Techno Main Salt Lake', shortCode: 'TMSL', city: 'Kolkata', state: 'West Bengal', category: 'Top Private' },
  { name: 'BIT Mesra - Birla Institute of Technology Mesra', shortCode: 'BIT-Mesra', city: 'Ranchi', state: 'Jharkhand', category: 'Top Private' },
];

export interface BranchInfo {
  name: string;
  code: string;
  category: 'Computing & IT' | 'Electrical & Electronics' | 'Core Engineering' | 'Interdisciplinary & Emerging';
}

export const BTECH_BRANCHES: BranchInfo[] = [
  // Computing & AI
  { name: 'Computer Science and Engineering (CSE)', code: 'CSE', category: 'Computing & IT' },
  { name: 'CSE - Artificial Intelligence & Machine Learning (AI/ML)', code: 'CSE-AIML', category: 'Computing & IT' },
  { name: 'CSE - Data Science (DS)', code: 'CSE-DS', category: 'Computing & IT' },
  { name: 'CSE - Cyber Security', code: 'CSE-Cyber', category: 'Computing & IT' },
  { name: 'CSE - Internet of Things (IoT)', code: 'CSE-IoT', category: 'Computing & IT' },
  { name: 'CSE - Cloud Computing & DevOps', code: 'CSE-Cloud', category: 'Computing & IT' },
  { name: 'Information Technology (IT)', code: 'IT', category: 'Computing & IT' },
  { name: 'Artificial Intelligence and Data Science (AI & DS)', code: 'AIDS', category: 'Computing & IT' },
  { name: 'Software Engineering (SE)', code: 'SE', category: 'Computing & IT' },
  { name: 'Mathematics and Computing (MnC)', code: 'MnC', category: 'Computing & IT' },

  // Electrical & Electronics
  { name: 'Electronics and Communication Engineering (ECE)', code: 'ECE', category: 'Electrical & Electronics' },
  { name: 'ECE - VLSI Design and Embedded Systems', code: 'ECE-VLSI', category: 'Electrical & Electronics' },
  { name: 'Electrical and Electronics Engineering (EEE)', code: 'EEE', category: 'Electrical & Electronics' },
  { name: 'Electronics and Telecommunication Engineering (ETC)', code: 'ETC', category: 'Electrical & Electronics' },
  { name: 'Electronics and Instrumentation Engineering (EIE)', code: 'EIE', category: 'Electrical & Electronics' },

  // Core Engineering
  { name: 'Mechanical Engineering (ME)', code: 'ME', category: 'Core Engineering' },
  { name: 'Civil Engineering (CE)', code: 'CE', category: 'Core Engineering' },
  { name: 'Chemical Engineering (ChE)', code: 'ChE', category: 'Core Engineering' },
  { name: 'Aerospace Engineering', code: 'AERO', category: 'Core Engineering' },
  { name: 'Automobile Engineering', code: 'AUTO', category: 'Core Engineering' },
  { name: 'Metallurgical and Materials Engineering (MME)', code: 'MME', category: 'Core Engineering' },
  { name: 'Mining Engineering', code: 'MIN', category: 'Core Engineering' },
  { name: 'Production and Industrial Engineering (PIE)', code: 'PIE', category: 'Core Engineering' },

  // Emerging & Interdisciplinary
  { name: 'Robotics and Automation Engineering', code: 'ROBO', category: 'Interdisciplinary & Emerging' },
  { name: 'Mechatronics Engineering', code: 'MECHTR', category: 'Interdisciplinary & Emerging' },
  { name: 'Biotechnology / Biochemical Engineering', code: 'BIOTECH', category: 'Interdisciplinary & Emerging' },
  { name: 'Biomedical Engineering (BME)', code: 'BME', category: 'Interdisciplinary & Emerging' },
  { name: 'Petroleum Engineering', code: 'PETRO', category: 'Interdisciplinary & Emerging' },
  { name: 'Agricultural and Food Engineering', code: 'AGRI', category: 'Interdisciplinary & Emerging' },
  { name: 'Environmental Engineering', code: 'ENV', category: 'Interdisciplinary & Emerging' },
  { name: 'Engineering Physics', code: 'EP', category: 'Interdisciplinary & Emerging' },
  { name: 'Naval Architecture and Marine Engineering', code: 'MARINE', category: 'Interdisciplinary & Emerging' },
];

export const ACADEMIC_YEARS = [
  '1st Year (Freshman)',
  '2nd Year (Sophomore)',
  '3rd Year (Junior)',
  '4th Year (Senior / Final Year)',
  '5th Year (Dual Degree / Integrated M.Tech)',
];

/**
 * Filter colleges matching query string (matches name, shortCode, city, or state)
 */
export function searchColleges(query: string, limit: number = 25): CollegeInfo[] {
  if (!query || query.trim().length === 0) {
    return TOP_INDIAN_COLLEGES.slice(0, limit);
  }
  const q = query.toLowerCase().trim();
  return TOP_INDIAN_COLLEGES.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.shortCode.toLowerCase().includes(q) ||
    c.city.toLowerCase().includes(q) ||
    c.state.toLowerCase().includes(q),
  ).slice(0, limit);
}

/**
 * Filter branches matching query string (matches name or code)
 */
export function searchBranches(query: string, limit: number = 20): BranchInfo[] {
  if (!query || query.trim().length === 0) {
    return BTECH_BRANCHES.slice(0, limit);
  }
  const q = query.toLowerCase().trim();
  return BTECH_BRANCHES.filter(b =>
    b.name.toLowerCase().includes(q) ||
    b.code.toLowerCase().includes(q),
  ).slice(0, limit);
}
