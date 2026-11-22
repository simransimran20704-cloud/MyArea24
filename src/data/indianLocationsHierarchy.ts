export interface LocalityItem {
  name: string;
  pincode: string;
  lat: number;
  lng: number;
}

export interface DistrictItem {
  district: string;
  localities: LocalityItem[];
}

export interface StateHierarchyItem {
  state: string;
  districts: DistrictItem[];
}

export const INDIAN_LOCATIONS_HIERARCHY: StateHierarchyItem[] = [
  {
    "state": "Delhi (NCT)",
    "districts": [
      {
        "district": "North Delhi",
        "localities": [
          {
            "name": "Narela",
            "pincode": "110040",
            "lat": 28.8526,
            "lng": 77.0933
          },
          {
            "name": "Alipur",
            "pincode": "110036",
            "lat": 28.7997,
            "lng": 77.1332
          },
          {
            "name": "Bawana",
            "pincode": "110039",
            "lat": 28.7972,
            "lng": 77.0345
          },
          {
            "name": "Burari",
            "pincode": "110084",
            "lat": 28.7541,
            "lng": 77.2024
          },
          {
            "name": "Model Town",
            "pincode": "110009",
            "lat": 28.7029,
            "lng": 77.1931
          },
          {
            "name": "Civil Lines",
            "pincode": "110054",
            "lat": 28.6792,
            "lng": 77.2223
          },
          {
            "name": "Mukarba Chowk",
            "pincode": "110033",
            "lat": 28.7454,
            "lng": 77.1528
          },
          {
            "name": "Jahangirpuri",
            "pincode": "110033",
            "lat": 28.7262,
            "lng": 77.1643
          },
          {
            "name": "Samaypur Badli",
            "pincode": "110042",
            "lat": 28.7451,
            "lng": 77.1378
          },
          {
            "name": "GTB Nagar & Kingsway Camp",
            "pincode": "110009",
            "lat": 28.6978,
            "lng": 77.2062
          },
          {
            "name": "Timarpur",
            "pincode": "110054",
            "lat": 28.6912,
            "lng": 77.2185
          },
          {
            "name": "Kashmere Gate",
            "pincode": "110006",
            "lat": 28.6665,
            "lng": 77.229
          }
        ]
      },
      {
        "district": "North West Delhi",
        "localities": [
          {
            "name": "Rohini Sector 1 to 9",
            "pincode": "110085",
            "lat": 28.7112,
            "lng": 77.1186
          },
          {
            "name": "Rohini Sector 11 to 18",
            "pincode": "110089",
            "lat": 28.7364,
            "lng": 77.1265
          },
          {
            "name": "Rohini Sector 20 to 25",
            "pincode": "110085",
            "lat": 28.745,
            "lng": 77.098
          },
          {
            "name": "Prashant Vihar",
            "pincode": "110085",
            "lat": 28.7144,
            "lng": 77.131
          },
          {
            "name": "Pitampura",
            "pincode": "110034",
            "lat": 28.699,
            "lng": 77.1384
          },
          {
            "name": "Shalimar Bagh",
            "pincode": "110088",
            "lat": 28.7164,
            "lng": 77.1627
          },
          {
            "name": "Sultanpuri JJ Colony",
            "pincode": "110086",
            "lat": 28.6942,
            "lng": 77.0688
          },
          {
            "name": "Mangolpuri",
            "pincode": "110083",
            "lat": 28.6953,
            "lng": 77.0864
          },
          {
            "name": "Rani Bagh & Shakurpur",
            "pincode": "110034",
            "lat": 28.6908,
            "lng": 77.1274
          },
          {
            "name": "Saraswati Vihar",
            "pincode": "110034",
            "lat": 28.692,
            "lng": 77.1315
          },
          {
            "name": "Ashok Vihar",
            "pincode": "110052",
            "lat": 28.6945,
            "lng": 77.175
          },
          {
            "name": "Kanjhawala",
            "pincode": "110081",
            "lat": 28.73,
            "lng": 77.001
          }
        ]
      },
      {
        "district": "New Delhi",
        "localities": [
          {
            "name": "Connaught Place",
            "pincode": "110001",
            "lat": 28.6315,
            "lng": 77.2167
          },
          {
            "name": "Janpath & Tolstoy Marg",
            "pincode": "110001",
            "lat": 28.625,
            "lng": 77.2185
          },
          {
            "name": "Gole Market",
            "pincode": "110001",
            "lat": 28.6328,
            "lng": 77.2025
          },
          {
            "name": "Khan Market",
            "pincode": "110003",
            "lat": 28.6003,
            "lng": 77.227
          },
          {
            "name": "Barakhamba Road",
            "pincode": "110001",
            "lat": 28.6294,
            "lng": 77.2281
          },
          {
            "name": "Chanakyapuri & Diplomatic Enclave",
            "pincode": "110021",
            "lat": 28.5954,
            "lng": 77.1855
          },
          {
            "name": "India Gate Area",
            "pincode": "110001",
            "lat": 28.6129,
            "lng": 77.2295
          },
          {
            "name": "Lodhi Colony & Golf Links",
            "pincode": "110003",
            "lat": 28.588,
            "lng": 77.224
          },
          {
            "name": "Bengali Market & Babar Road",
            "pincode": "110001",
            "lat": 28.628,
            "lng": 77.234
          }
        ]
      },
      {
        "district": "Central Delhi",
        "localities": [
          {
            "name": "Karol Bagh",
            "pincode": "110005",
            "lat": 28.6517,
            "lng": 77.1906
          },
          {
            "name": "Rajendra Nagar & Old Rajinder Nagar",
            "pincode": "110060",
            "lat": 28.6415,
            "lng": 77.1812
          },
          {
            "name": "Paharganj",
            "pincode": "110055",
            "lat": 28.6448,
            "lng": 77.2144
          },
          {
            "name": "Chandni Chowk",
            "pincode": "110006",
            "lat": 28.6506,
            "lng": 77.2303
          },
          {
            "name": "Daryaganj & Delhi Gate",
            "pincode": "110002",
            "lat": 28.6469,
            "lng": 77.241
          },
          {
            "name": "Ajmeri Gate",
            "pincode": "110006",
            "lat": 28.644,
            "lng": 77.223
          },
          {
            "name": "Anand Parbat",
            "pincode": "110005",
            "lat": 28.665,
            "lng": 77.172
          }
        ]
      },
      {
        "district": "South Delhi",
        "localities": [
          {
            "name": "Saket",
            "pincode": "110017",
            "lat": 28.5244,
            "lng": 77.2167
          },
          {
            "name": "Hauz Khas & Village",
            "pincode": "110016",
            "lat": 28.5494,
            "lng": 77.2001
          },
          {
            "name": "Malviya Nagar",
            "pincode": "110017",
            "lat": 28.5365,
            "lng": 77.212
          },
          {
            "name": "Greater Kailash 1 & 2",
            "pincode": "110048",
            "lat": 28.5482,
            "lng": 77.2343
          },
          {
            "name": "Green Park & Safdarjung",
            "pincode": "110016",
            "lat": 28.558,
            "lng": 77.202
          },
          {
            "name": "Vasant Kunj",
            "pincode": "110070",
            "lat": 28.5284,
            "lng": 77.1517
          },
          {
            "name": "Vasant Vihar",
            "pincode": "110057",
            "lat": 28.56,
            "lng": 77.16
          },
          {
            "name": "Mehrauli & Qutub Minar",
            "pincode": "110030",
            "lat": 28.5175,
            "lng": 77.1837
          },
          {
            "name": "Chhatarpur",
            "pincode": "110074",
            "lat": 28.502,
            "lng": 77.179
          },
          {
            "name": "Sainik Farm",
            "pincode": "110062",
            "lat": 28.508,
            "lng": 77.215
          }
        ]
      },
      {
        "district": "South East Delhi",
        "localities": [
          {
            "name": "Lajpat Nagar 1 to 4",
            "pincode": "110024",
            "lat": 28.57,
            "lng": 77.24
          },
          {
            "name": "Defence Colony",
            "pincode": "110024",
            "lat": 28.573,
            "lng": 77.232
          },
          {
            "name": "Nehru Place",
            "pincode": "110019",
            "lat": 28.549,
            "lng": 77.252
          },
          {
            "name": "Kalkaji & Govindpuri",
            "pincode": "110019",
            "lat": 28.542,
            "lng": 77.258
          },
          {
            "name": "New Friends Colony & Maharani Bagh",
            "pincode": "110025",
            "lat": 28.56,
            "lng": 77.28
          },
          {
            "name": "Okhla Industrial Area Phase 1-3",
            "pincode": "110020",
            "lat": 28.528,
            "lng": 77.275
          },
          {
            "name": "Sarita Vihar & Jasola",
            "pincode": "110076",
            "lat": 28.535,
            "lng": 77.298
          },
          {
            "name": "Jamia Nagar & Batla House",
            "pincode": "110025",
            "lat": 28.562,
            "lng": 77.289
          },
          {
            "name": "Badarpur Border",
            "pincode": "110044",
            "lat": 28.498,
            "lng": 77.302
          }
        ]
      },
      {
        "district": "West Delhi",
        "localities": [
          {
            "name": "Janakpuri",
            "pincode": "110058",
            "lat": 28.6219,
            "lng": 77.0878
          },
          {
            "name": "Punjabi Bagh East & West",
            "pincode": "110026",
            "lat": 28.6692,
            "lng": 77.1315
          },
          {
            "name": "Rajouri Garden",
            "pincode": "110027",
            "lat": 28.6472,
            "lng": 77.1232
          },
          {
            "name": "Paschim Vihar",
            "pincode": "110063",
            "lat": 28.6698,
            "lng": 77.0984
          },
          {
            "name": "Tilak Nagar",
            "pincode": "110018",
            "lat": 28.6366,
            "lng": 77.0963
          },
          {
            "name": "Vikaspuri",
            "pincode": "110018",
            "lat": 28.638,
            "lng": 77.072
          },
          {
            "name": "Uttam Nagar",
            "pincode": "110059",
            "lat": 28.622,
            "lng": 77.055
          },
          {
            "name": "Nangloi",
            "pincode": "110041",
            "lat": 28.675,
            "lng": 77.058
          },
          {
            "name": "Patel Nagar East & West",
            "pincode": "110008",
            "lat": 28.652,
            "lng": 77.165
          },
          {
            "name": "Kirti Nagar & Mansarover Garden",
            "pincode": "110015",
            "lat": 28.65,
            "lng": 77.142
          }
        ]
      },
      {
        "district": "South West Delhi",
        "localities": [
          {
            "name": "Dwarka Sector 1 to 10",
            "pincode": "110075",
            "lat": 28.5815,
            "lng": 77.0583
          },
          {
            "name": "Dwarka Sector 11 to 23",
            "pincode": "110077",
            "lat": 28.5522,
            "lng": 77.0582
          },
          {
            "name": "Dwarka Expressway / Sector 25",
            "pincode": "110077",
            "lat": 28.545,
            "lng": 77.035
          },
          {
            "name": "Najafgarh",
            "pincode": "110043",
            "lat": 28.609,
            "lng": 76.9855
          },
          {
            "name": "Palam Colony",
            "pincode": "110045",
            "lat": 28.591,
            "lng": 77.0863
          },
          {
            "name": "Mahipalpur & Aerocity",
            "pincode": "110037",
            "lat": 28.548,
            "lng": 77.125
          },
          {
            "name": "Delhi Cantt",
            "pincode": "110010",
            "lat": 28.598,
            "lng": 77.135
          },
          {
            "name": "Kapashera Border",
            "pincode": "110037",
            "lat": 28.52,
            "lng": 77.085
          }
        ]
      },
      {
        "district": "East Delhi",
        "localities": [
          {
            "name": "Laxmi Nagar & Shakarpur",
            "pincode": "110092",
            "lat": 28.6309,
            "lng": 77.2773
          },
          {
            "name": "Mayur Vihar Phase 1, 2 & 3",
            "pincode": "110091",
            "lat": 28.6074,
            "lng": 77.2985
          },
          {
            "name": "Preet Vihar & Nirman Vihar",
            "pincode": "110092",
            "lat": 28.6418,
            "lng": 77.2942
          },
          {
            "name": "Anand Vihar ISBT & Railway Station",
            "pincode": "110092",
            "lat": 28.6483,
            "lng": 77.3153
          },
          {
            "name": "Patparganj Industrial Area",
            "pincode": "110092",
            "lat": 28.632,
            "lng": 77.308
          },
          {
            "name": "IP Extension",
            "pincode": "110092",
            "lat": 28.6325,
            "lng": 77.304
          },
          {
            "name": "Gandhi Nagar & Geeta Colony",
            "pincode": "110031",
            "lat": 28.658,
            "lng": 77.272
          }
        ]
      },
      {
        "district": "Shahdara",
        "localities": [
          {
            "name": "Shahdara Main Market",
            "pincode": "110032",
            "lat": 28.672,
            "lng": 77.295
          },
          {
            "name": "Dilshad Garden",
            "pincode": "110095",
            "lat": 28.685,
            "lng": 77.318
          },
          {
            "name": "Vivek Vihar",
            "pincode": "110095",
            "lat": 28.665,
            "lng": 77.312
          },
          {
            "name": "Jhilmil Colony",
            "pincode": "110095",
            "lat": 28.674,
            "lng": 77.315
          },
          {
            "name": "Seemapuri",
            "pincode": "110095",
            "lat": 28.692,
            "lng": 77.325
          }
        ]
      },
      {
        "district": "North East Delhi",
        "localities": [
          {
            "name": "Yamuna Vihar",
            "pincode": "110053",
            "lat": 28.705,
            "lng": 77.275
          },
          {
            "name": "Seelampur & Shastri Park",
            "pincode": "110053",
            "lat": 28.673,
            "lng": 77.268
          },
          {
            "name": "Gokulpuri & Bhajanpura",
            "pincode": "110094",
            "lat": 28.701,
            "lng": 77.288
          },
          {
            "name": "Karawal Nagar",
            "pincode": "110094",
            "lat": 28.73,
            "lng": 77.285
          }
        ]
      }
    ]
  },
  {
    "state": "Uttar Pradesh",
    "districts": [
      {
        "district": "Gautam Buddha Nagar (Noida)",
        "localities": [
          {
            "name": "Noida Sector 18 (Atta Market)",
            "pincode": "201301",
            "lat": 28.5708,
            "lng": 77.3271
          },
          {
            "name": "Noida Sector 62 (IT Hub)",
            "pincode": "201309",
            "lat": 28.628,
            "lng": 77.3649
          },
          {
            "name": "Noida Sector 137 & Advant Navis",
            "pincode": "201305",
            "lat": 28.5037,
            "lng": 77.4057
          },
          {
            "name": "Noida Sector 50 & 52",
            "pincode": "201301",
            "lat": 28.582,
            "lng": 77.362
          },
          {
            "name": "Noida Sector 76, 77 & 78",
            "pincode": "201301",
            "lat": 28.568,
            "lng": 77.382
          },
          {
            "name": "Greater Noida West (Noida Extension)",
            "pincode": "201306",
            "lat": 28.5977,
            "lng": 77.4475
          },
          {
            "name": "Pari Chowk, Greater Noida",
            "pincode": "201310",
            "lat": 28.4632,
            "lng": 77.511
          },
          {
            "name": "Knowledge Park 1, 2 & 3",
            "pincode": "201310",
            "lat": 28.461,
            "lng": 77.495
          },
          {
            "name": "Omega, Alpha & Beta Greater Noida",
            "pincode": "201308",
            "lat": 28.475,
            "lng": 77.505
          }
        ]
      },
      {
        "district": "Ghaziabad",
        "localities": [
          {
            "name": "Indirapuram (Shipra Mall / Ahinsa Khand)",
            "pincode": "201014",
            "lat": 28.6415,
            "lng": 77.3714
          },
          {
            "name": "Vaishali Sector 1 to 9",
            "pincode": "201010",
            "lat": 28.6489,
            "lng": 77.3392
          },
          {
            "name": "Vasundhara Sector 1 to 19",
            "pincode": "201012",
            "lat": 28.6606,
            "lng": 77.3622
          },
          {
            "name": "Raj Nagar Extension",
            "pincode": "201017",
            "lat": 28.7088,
            "lng": 77.4363
          },
          {
            "name": "Kaushambi",
            "pincode": "201010",
            "lat": 28.6436,
            "lng": 77.3235
          },
          {
            "name": "Crossings Republik",
            "pincode": "201016",
            "lat": 28.632,
            "lng": 77.428
          },
          {
            "name": "Kavi Nagar & Shastri Nagar",
            "pincode": "201002",
            "lat": 28.672,
            "lng": 77.452
          }
        ]
      },
      {
        "district": "Lucknow",
        "localities": [
          {
            "name": "Gomti Nagar (Vibhuti Khand / Patrakarpuram)",
            "pincode": "226010",
            "lat": 26.853,
            "lng": 80.9984
          },
          {
            "name": "Gomti Nagar Extension",
            "pincode": "226010",
            "lat": 26.832,
            "lng": 81.018
          },
          {
            "name": "Hazratganj Main Market",
            "pincode": "226001",
            "lat": 26.8467,
            "lng": 80.9462
          },
          {
            "name": "Aliganj & Kapoorthala",
            "pincode": "226024",
            "lat": 26.885,
            "lng": 80.941
          },
          {
            "name": "Indira Nagar",
            "pincode": "226016",
            "lat": 26.8837,
            "lng": 80.9855
          },
          {
            "name": "Alambagh & Singar Nagar",
            "pincode": "226005",
            "lat": 26.8143,
            "lng": 80.9022
          },
          {
            "name": "Mahanagar",
            "pincode": "226006",
            "lat": 26.872,
            "lng": 80.958
          },
          {
            "name": "Charbagh Railway Station",
            "pincode": "226004",
            "lat": 26.831,
            "lng": 80.919
          }
        ]
      },
      {
        "district": "Kanpur",
        "localities": [
          {
            "name": "Civil Lines, Kanpur",
            "pincode": "208001",
            "lat": 26.4727,
            "lng": 80.3478
          },
          {
            "name": "Swaroop Nagar",
            "pincode": "208002",
            "lat": 26.4862,
            "lng": 80.3157
          },
          {
            "name": "Kakadeo (Coaching Hub)",
            "pincode": "208025",
            "lat": 26.482,
            "lng": 80.292
          },
          {
            "name": "Govind Nagar & Kidwai Nagar",
            "pincode": "208006",
            "lat": 26.439,
            "lng": 80.322
          }
        ]
      },
      {
        "district": "Varanasi",
        "localities": [
          {
            "name": "Godaulia & Dashashwamedh Ghat",
            "pincode": "221001",
            "lat": 25.308,
            "lng": 83.007
          },
          {
            "name": "Sigra & Cantt",
            "pincode": "221002",
            "lat": 25.321,
            "lng": 82.986
          },
          {
            "name": "BHU Campus & Lanka",
            "pincode": "221005",
            "lat": 25.267,
            "lng": 82.992
          }
        ]
      },
      {
        "district": "Agra",
        "localities": [
          {
            "name": "Tajganj & Fatehabad Road",
            "pincode": "282001",
            "lat": 27.168,
            "lng": 78.042
          },
          {
            "name": "Sanjay Place (Commercial Hub)",
            "pincode": "282002",
            "lat": 27.202,
            "lng": 77.998
          },
          {
            "name": "Kamla Nagar & Dayalbagh",
            "pincode": "282005",
            "lat": 27.228,
            "lng": 78.012
          }
        ]
      }
    ]
  },
  {
    "state": "Haryana",
    "districts": [
      {
        "district": "Gurugram",
        "localities": [
          {
            "name": "DLF Cyber City & Cyber Hub",
            "pincode": "122002",
            "lat": 28.495,
            "lng": 77.0895
          },
          {
            "name": "Golf Course Road & Sector 54",
            "pincode": "122003",
            "lat": 28.4682,
            "lng": 77.1026
          },
          {
            "name": "Golf Course Extension Road & Sector 65",
            "pincode": "122018",
            "lat": 28.405,
            "lng": 77.082
          },
          {
            "name": "Sector 29 Leisure Valley",
            "pincode": "122009",
            "lat": 28.4684,
            "lng": 77.0628
          },
          {
            "name": "Sohna Road & Subhash Chowk",
            "pincode": "122018",
            "lat": 28.4116,
            "lng": 77.0422
          },
          {
            "name": "Palam Vihar",
            "pincode": "122017",
            "lat": 28.5135,
            "lng": 77.0371
          },
          {
            "name": "Sector 14 & Old Gurugram",
            "pincode": "122001",
            "lat": 28.472,
            "lng": 77.045
          },
          {
            "name": "Sector 45 & 46 (Huda City Centre)",
            "pincode": "122003",
            "lat": 28.452,
            "lng": 77.072
          },
          {
            "name": "Dwarka Expressway Gurugram (Sector 102-113)",
            "pincode": "122006",
            "lat": 28.498,
            "lng": 76.985
          },
          {
            "name": "Manesar IMT",
            "pincode": "122051",
            "lat": 28.362,
            "lng": 76.932
          }
        ]
      },
      {
        "district": "Faridabad",
        "localities": [
          {
            "name": "Sector 15 & 16 Faridabad",
            "pincode": "121007",
            "lat": 28.4089,
            "lng": 77.3178
          },
          {
            "name": "NIT Faridabad 1-5",
            "pincode": "121001",
            "lat": 28.3888,
            "lng": 77.3023
          },
          {
            "name": "Green Field Colony & Surajkund",
            "pincode": "121003",
            "lat": 28.4552,
            "lng": 77.3005
          },
          {
            "name": "Greater Faridabad (Neharpar Sector 75-89)",
            "pincode": "121002",
            "lat": 28.402,
            "lng": 77.362
          }
        ]
      },
      {
        "district": "Panchkula",
        "localities": [
          {
            "name": "Sector 5 Panchkula",
            "pincode": "134109",
            "lat": 30.695,
            "lng": 76.852
          },
          {
            "name": "Sector 20 Panchkula",
            "pincode": "134116",
            "lat": 30.668,
            "lng": 76.842
          },
          {
            "name": "MDC Sector 4 & 6",
            "pincode": "134114",
            "lat": 30.718,
            "lng": 76.838
          }
        ]
      }
    ]
  },
  {
    "state": "Maharashtra",
    "districts": [
      {
        "district": "Mumbai City & Suburban",
        "localities": [
          {
            "name": "Bandra West (Linking Road / Hill Road)",
            "pincode": "400050",
            "lat": 19.0596,
            "lng": 72.8295
          },
          {
            "name": "Bandra East & BKC (Bandra Kurla Complex)",
            "pincode": "400051",
            "lat": 19.0665,
            "lng": 72.868
          },
          {
            "name": "Andheri West (Lokhandwala / Versova)",
            "pincode": "400058",
            "lat": 19.1363,
            "lng": 72.8277
          },
          {
            "name": "Andheri East (MIDC / Chakala / Marol)",
            "pincode": "400069",
            "lat": 19.118,
            "lng": 72.868
          },
          {
            "name": "Juhu Beach & Vile Parle",
            "pincode": "400049",
            "lat": 19.098,
            "lng": 72.826
          },
          {
            "name": "Colaba & Nariman Point",
            "pincode": "400005",
            "lat": 18.9067,
            "lng": 72.8147
          },
          {
            "name": "Marine Lines & Churchgate",
            "pincode": "400020",
            "lat": 18.942,
            "lng": 72.824
          },
          {
            "name": "Dadar West & Shivaji Park",
            "pincode": "400028",
            "lat": 19.022,
            "lng": 72.838
          },
          {
            "name": "Powai (Hiranandani Gardens)",
            "pincode": "400076",
            "lat": 19.1176,
            "lng": 72.906
          },
          {
            "name": "Goregaon East & West (Film City)",
            "pincode": "400063",
            "lat": 19.168,
            "lng": 72.858
          },
          {
            "name": "Malad West & Link Road",
            "pincode": "400064",
            "lat": 19.186,
            "lng": 72.848
          },
          {
            "name": "Borivali West & IC Colony",
            "pincode": "400092",
            "lat": 19.231,
            "lng": 72.856
          },
          {
            "name": "Ghatkopar East & West",
            "pincode": "400077",
            "lat": 19.086,
            "lng": 72.908
          },
          {
            "name": "Chembur & Diamond Garden",
            "pincode": "400071",
            "lat": 19.052,
            "lng": 72.898
          }
        ]
      },
      {
        "district": "Thane & Navi Mumbai",
        "localities": [
          {
            "name": "Thane West (Ghodbunder Road / Naupada)",
            "pincode": "400601",
            "lat": 19.2183,
            "lng": 72.9781
          },
          {
            "name": "Majiwada & Pokhran Road",
            "pincode": "400606",
            "lat": 19.215,
            "lng": 72.985
          },
          {
            "name": "Vashi Sector 17 (Navi Mumbai)",
            "pincode": "400703",
            "lat": 19.077,
            "lng": 72.998
          },
          {
            "name": "Kharghar (Hiranandani / Central Park)",
            "pincode": "410210",
            "lat": 19.034,
            "lng": 73.068
          },
          {
            "name": "Nerul & Seawoods Grand Central",
            "pincode": "400706",
            "lat": 19.028,
            "lng": 73.018
          },
          {
            "name": "Belapur CBD",
            "pincode": "400614",
            "lat": 19.018,
            "lng": 73.038
          },
          {
            "name": "Panvel & New Panvel",
            "pincode": "410206",
            "lat": 18.992,
            "lng": 73.118
          }
        ]
      },
      {
        "district": "Pune",
        "localities": [
          {
            "name": "Koregaon Park & North Main Road",
            "pincode": "411001",
            "lat": 18.5362,
            "lng": 73.894
          },
          {
            "name": "Kothrud & Karve Nagar",
            "pincode": "411038",
            "lat": 18.5074,
            "lng": 73.8077
          },
          {
            "name": "Hinjawadi IT Park Phase 1-3",
            "pincode": "411057",
            "lat": 18.5913,
            "lng": 73.7389
          },
          {
            "name": "Viman Nagar (Phoenix Marketcity)",
            "pincode": "411014",
            "lat": 18.5679,
            "lng": 73.9143
          },
          {
            "name": "Kalyani Nagar",
            "pincode": "411006",
            "lat": 18.549,
            "lng": 73.902
          },
          {
            "name": "Baner & Balewadi High Street",
            "pincode": "411045",
            "lat": 18.568,
            "lng": 73.785
          },
          {
            "name": "Wakad & Pimple Saudagar",
            "pincode": "411057",
            "lat": 18.598,
            "lng": 73.765
          },
          {
            "name": "Magarpatta City & Hadapsar",
            "pincode": "411028",
            "lat": 18.514,
            "lng": 73.928
          },
          {
            "name": "Aundh",
            "pincode": "411007",
            "lat": 18.562,
            "lng": 73.808
          },
          {
            "name": "Shivajinagar & FC Road",
            "pincode": "411005",
            "lat": 18.531,
            "lng": 73.844
          }
        ]
      },
      {
        "district": "Nagpur",
        "localities": [
          {
            "name": "Dharampeth & Ramdaspeth",
            "pincode": "440010",
            "lat": 21.142,
            "lng": 79.068
          },
          {
            "name": "Sadar & Civil Lines",
            "pincode": "440001",
            "lat": 21.158,
            "lng": 79.082
          },
          {
            "name": "Manish Nagar & Wardha Road",
            "pincode": "440015",
            "lat": 21.085,
            "lng": 79.075
          }
        ]
      }
    ]
  },
  {
    "state": "Karnataka",
    "districts": [
      {
        "district": "Bengaluru Urban",
        "localities": [
          {
            "name": "Koramangala 1st to 8th Block",
            "pincode": "560034",
            "lat": 12.9352,
            "lng": 77.6245
          },
          {
            "name": "Indiranagar (100 Feet Road / 12th Main)",
            "pincode": "560038",
            "lat": 12.9784,
            "lng": 77.6408
          },
          {
            "name": "Whitefield (ITPL / EPIP Zone)",
            "pincode": "560066",
            "lat": 12.9698,
            "lng": 77.75
          },
          {
            "name": "HSR Layout Sector 1 to 7",
            "pincode": "560102",
            "lat": 12.9121,
            "lng": 77.6446
          },
          {
            "name": "Jayanagar 1st to 9th Block",
            "pincode": "560011",
            "lat": 12.9308,
            "lng": 77.5838
          },
          {
            "name": "JP Nagar Phase 1 to 8",
            "pincode": "560078",
            "lat": 12.906,
            "lng": 77.585
          },
          {
            "name": "BTM Layout 1st & 2nd Stage",
            "pincode": "560068",
            "lat": 12.916,
            "lng": 77.61
          },
          {
            "name": "Electronic City Phase 1 & 2",
            "pincode": "560100",
            "lat": 12.839,
            "lng": 77.677
          },
          {
            "name": "Marathahalli & Outer Ring Road (ORR)",
            "pincode": "560037",
            "lat": 12.956,
            "lng": 77.701
          },
          {
            "name": "Bellandur & EcoSpace",
            "pincode": "560103",
            "lat": 12.926,
            "lng": 77.678
          },
          {
            "name": "Malleshwaram",
            "pincode": "560003",
            "lat": 13.006,
            "lng": 77.571
          },
          {
            "name": "Rajajinagar",
            "pincode": "560010",
            "lat": 12.998,
            "lng": 77.555
          },
          {
            "name": "Hebbal & Manyata Tech Park",
            "pincode": "560045",
            "lat": 13.045,
            "lng": 77.618
          },
          {
            "name": "Yelahanka New Town",
            "pincode": "560064",
            "lat": 13.1,
            "lng": 77.596
          },
          {
            "name": "Banashankari & Basavanagudi",
            "pincode": "560050",
            "lat": 12.942,
            "lng": 77.574
          },
          {
            "name": "MG Road & Brigade Road",
            "pincode": "560001",
            "lat": 12.975,
            "lng": 77.608
          }
        ]
      },
      {
        "district": "Mysuru",
        "localities": [
          {
            "name": "Gokulam & Jayalakshmipuram",
            "pincode": "570002",
            "lat": 12.331,
            "lng": 76.628
          },
          {
            "name": "Vijayanagar 1st-4th Stage",
            "pincode": "570017",
            "lat": 12.338,
            "lng": 76.602
          },
          {
            "name": "KRS Road & Hebbal Industrial Area",
            "pincode": "570016",
            "lat": 12.368,
            "lng": 76.608
          }
        ]
      }
    ]
  },
  {
    "state": "Telangana",
    "districts": [
      {
        "district": "Hyderabad",
        "localities": [
          {
            "name": "Banjara Hills Road No 1 to 14",
            "pincode": "500034",
            "lat": 17.4156,
            "lng": 78.435
          },
          {
            "name": "Jubilee Hills & Checkpost",
            "pincode": "500033",
            "lat": 17.4319,
            "lng": 78.4073
          },
          {
            "name": "Gachibowli & Financial District",
            "pincode": "500032",
            "lat": 17.4401,
            "lng": 78.3489
          },
          {
            "name": "Hitec City (Cyber Towers / Mindspace)",
            "pincode": "500081",
            "lat": 17.4474,
            "lng": 78.3762
          },
          {
            "name": "Madhapur (Ayyappa Society)",
            "pincode": "500081",
            "lat": 17.448,
            "lng": 78.391
          },
          {
            "name": "Kondapur & Botanical Garden",
            "pincode": "500084",
            "lat": 17.468,
            "lng": 78.358
          },
          {
            "name": "Kukatpally & KPHB Colony",
            "pincode": "500072",
            "lat": 17.493,
            "lng": 78.401
          },
          {
            "name": "Begumpet & Somajiguda",
            "pincode": "500016",
            "lat": 17.444,
            "lng": 78.468
          },
          {
            "name": "Ameerpet & SR Nagar",
            "pincode": "500038",
            "lat": 17.437,
            "lng": 78.448
          },
          {
            "name": "Secunderabad & Paradise",
            "pincode": "500003",
            "lat": 17.441,
            "lng": 78.501
          },
          {
            "name": "Dilsukhnagar & LB Nagar",
            "pincode": "500060",
            "lat": 17.368,
            "lng": 78.528
          },
          {
            "name": "Charminar & Old City",
            "pincode": "500002",
            "lat": 17.3616,
            "lng": 78.4747
          }
        ]
      }
    ]
  },
  {
    "state": "Tamil Nadu",
    "districts": [
      {
        "district": "Chennai",
        "localities": [
          {
            "name": "T Nagar (Pondy Bazaar / Panagal Park)",
            "pincode": "600017",
            "lat": 13.0418,
            "lng": 80.2341
          },
          {
            "name": "Anna Nagar East & West",
            "pincode": "600040",
            "lat": 13.085,
            "lng": 80.21
          },
          {
            "name": "Adyar & Gandhi Nagar",
            "pincode": "600020",
            "lat": 13.0012,
            "lng": 80.2565
          },
          {
            "name": "Besant Nagar (Elliot's Beach)",
            "pincode": "600090",
            "lat": 12.998,
            "lng": 80.268
          },
          {
            "name": "Mylapore & Mandaveli",
            "pincode": "600004",
            "lat": 13.036,
            "lng": 80.267
          },
          {
            "name": "Velachery (Phoenix Marketcity)",
            "pincode": "600042",
            "lat": 12.975,
            "lng": 80.221
          },
          {
            "name": "OMR (Old Mahabalipuram Road IT Corridor)",
            "pincode": "600096",
            "lat": 12.924,
            "lng": 80.231
          },
          {
            "name": "Nungambakkam & Khader Nawaz Khan Road",
            "pincode": "600034",
            "lat": 13.058,
            "lng": 80.242
          },
          {
            "name": "Kilpauk & Poonamallee High Road",
            "pincode": "600010",
            "lat": 13.081,
            "lng": 80.241
          },
          {
            "name": "Guindy & Ekkatuthangal",
            "pincode": "600032",
            "lat": 13.008,
            "lng": 80.208
          }
        ]
      },
      {
        "district": "Coimbatore",
        "localities": [
          {
            "name": "RS Puram",
            "pincode": "641002",
            "lat": 11.008,
            "lng": 76.948
          },
          {
            "name": "Gandhipuram & Cross Cut Road",
            "pincode": "641012",
            "lat": 11.018,
            "lng": 76.968
          },
          {
            "name": "Peelamedu & Avinashi Road",
            "pincode": "641004",
            "lat": 11.032,
            "lng": 77.008
          }
        ]
      }
    ]
  },
  {
    "state": "West Bengal",
    "districts": [
      {
        "district": "Kolkata",
        "localities": [
          {
            "name": "Park Street & Camac Street",
            "pincode": "700016",
            "lat": 22.551,
            "lng": 88.352
          },
          {
            "name": "Salt Lake Sector 1 to 5 (Bidhannagar)",
            "pincode": "700091",
            "lat": 22.58,
            "lng": 88.42
          },
          {
            "name": "New Town (Action Area 1, 2 & 3)",
            "pincode": "700156",
            "lat": 22.595,
            "lng": 88.48
          },
          {
            "name": "Ballygunge & Gariahat",
            "pincode": "700019",
            "lat": 22.528,
            "lng": 88.365
          },
          {
            "name": "Alipore & New Alipore",
            "pincode": "700027",
            "lat": 22.531,
            "lng": 88.332
          },
          {
            "name": "Jadavpur & Dhakuria",
            "pincode": "700032",
            "lat": 22.498,
            "lng": 88.371
          },
          {
            "name": "Behala & Taratala",
            "pincode": "700034",
            "lat": 22.498,
            "lng": 88.318
          },
          {
            "name": "Howrah Station & Shibpur",
            "pincode": "711101",
            "lat": 22.585,
            "lng": 88.341
          },
          {
            "name": "Dum Dum & Airport",
            "pincode": "700028",
            "lat": 22.642,
            "lng": 88.431
          }
        ]
      }
    ]
  },
  {
    "state": "Gujarat",
    "districts": [
      {
        "district": "Ahmedabad",
        "localities": [
          {
            "name": "Navrangpura & CG Road",
            "pincode": "380009",
            "lat": 23.036,
            "lng": 72.561
          },
          {
            "name": "Vastrapur & IIM Ahmedabad",
            "pincode": "380015",
            "lat": 23.034,
            "lng": 72.528
          },
          {
            "name": "Bodakdev & Judges Bungalow Road",
            "pincode": "380054",
            "lat": 23.048,
            "lng": 72.512
          },
          {
            "name": "Satellite & Jodhpur Gam",
            "pincode": "380015",
            "lat": 23.024,
            "lng": 72.518
          },
          {
            "name": "SG Highway & Prahlad Nagar",
            "pincode": "380051",
            "lat": 23.011,
            "lng": 72.508
          },
          {
            "name": "Maninagar & Kankaria Lake",
            "pincode": "380008",
            "lat": 22.998,
            "lng": 72.602
          },
          {
            "name": "Chandkheda & Motera (Narendra Modi Stadium)",
            "pincode": "382424",
            "lat": 23.102,
            "lng": 72.598
          }
        ]
      },
      {
        "district": "Surat",
        "localities": [
          {
            "name": "Adajan & Pal",
            "pincode": "395009",
            "lat": 21.198,
            "lng": 72.795
          },
          {
            "name": "Vesu & VIP Road",
            "pincode": "395007",
            "lat": 21.142,
            "lng": 72.782
          },
          {
            "name": "Ring Road Textile Market",
            "pincode": "395002",
            "lat": 21.188,
            "lng": 72.835
          }
        ]
      }
    ]
  },
  {
    "state": "Rajasthan",
    "districts": [
      {
        "district": "Jaipur",
        "localities": [
          {
            "name": "Malviya Nagar & Gaurav Tower (GT)",
            "pincode": "302017",
            "lat": 26.853,
            "lng": 75.8177
          },
          {
            "name": "Vaishali Nagar & Amrapali Circle",
            "pincode": "302021",
            "lat": 26.9066,
            "lng": 75.7431
          },
          {
            "name": "C-Scheme & MI Road",
            "pincode": "302001",
            "lat": 26.9118,
            "lng": 75.8037
          },
          {
            "name": "Mansarovar & Madhyam Marg",
            "pincode": "302020",
            "lat": 26.858,
            "lng": 75.7645
          },
          {
            "name": "Raja Park & Tilak Nagar",
            "pincode": "302004",
            "lat": 26.898,
            "lng": 75.832
          },
          {
            "name": "Tonk Road & Durgapura",
            "pincode": "302018",
            "lat": 26.848,
            "lng": 75.792
          },
          {
            "name": "Jagatpura & Sitapura Industrial Area",
            "pincode": "302022",
            "lat": 26.812,
            "lng": 75.838
          }
        ]
      },
      {
        "district": "Jodhpur",
        "localities": [
          {
            "name": "Ratanada & Circuit House Road",
            "pincode": "342001",
            "lat": 26.275,
            "lng": 73.032
          },
          {
            "name": "Shastri Nagar",
            "pincode": "342003",
            "lat": 26.268,
            "lng": 73.008
          }
        ]
      }
    ]
  },
  {
    "state": "Punjab & Chandigarh",
    "districts": [
      {
        "district": "Chandigarh (UT)",
        "localities": [
          {
            "name": "Sector 17 Plaza (City Centre)",
            "pincode": "160017",
            "lat": 30.7398,
            "lng": 76.7827
          },
          {
            "name": "Sector 35 & 22 (Market Hubs)",
            "pincode": "160035",
            "lat": 30.725,
            "lng": 76.765
          },
          {
            "name": "Sector 8 & 9 (Inner Market)",
            "pincode": "160009",
            "lat": 30.745,
            "lng": 76.792
          },
          {
            "name": "Sector 43 (ISBT Bus Stand)",
            "pincode": "160043",
            "lat": 30.718,
            "lng": 76.742
          },
          {
            "name": "IT Park Kishangarh",
            "pincode": "160101",
            "lat": 30.728,
            "lng": 76.845
          }
        ]
      },
      {
        "district": "SAS Nagar (Mohali)",
        "localities": [
          {
            "name": "Phase 3B2 & Phase 7 Mohali",
            "pincode": "160059",
            "lat": 30.708,
            "lng": 76.715
          },
          {
            "name": "Sector 70 & 71 Mohali",
            "pincode": "160071",
            "lat": 30.698,
            "lng": 76.712
          },
          {
            "name": "Aerocity & IT City Mohali",
            "pincode": "140306",
            "lat": 30.638,
            "lng": 76.782
          }
        ]
      },
      {
        "district": "Ludhiana",
        "localities": [
          {
            "name": "Civil Lines & Fountain Chowk",
            "pincode": "141001",
            "lat": 30.908,
            "lng": 75.842
          },
          {
            "name": "Sarabha Nagar & Kipps Market",
            "pincode": "141001",
            "lat": 30.885,
            "lng": 75.815
          },
          {
            "name": "BRS Nagar & Ferozepur Road",
            "pincode": "141012",
            "lat": 30.878,
            "lng": 75.798
          }
        ]
      }
    ]
  },
  {
    "state": "Madhya Pradesh",
    "districts": [
      {
        "district": "Indore",
        "localities": [
          {
            "name": "Vijay Nagar & Scheme 54",
            "pincode": "452010",
            "lat": 22.7533,
            "lng": 75.8937
          },
          {
            "name": "Palasia (Old & New)",
            "pincode": "452001",
            "lat": 22.724,
            "lng": 75.885
          },
          {
            "name": "Bhanwarkuan & AB Road",
            "pincode": "452001",
            "lat": 22.695,
            "lng": 75.865
          },
          {
            "name": "Sarafa & Rajwada",
            "pincode": "452002",
            "lat": 22.718,
            "lng": 75.855
          }
        ]
      },
      {
        "district": "Bhopal",
        "localities": [
          {
            "name": "MP Nagar Zone 1 & 2",
            "pincode": "462011",
            "lat": 23.232,
            "lng": 77.435
          },
          {
            "name": "Arera Colony E1 to E8",
            "pincode": "462016",
            "lat": 23.212,
            "lng": 77.428
          },
          {
            "name": "New Market & TT Nagar",
            "pincode": "462003",
            "lat": 23.238,
            "lng": 77.402
          }
        ]
      }
    ]
  },
  {
    "state": "Bihar & Jharkhand",
    "districts": [
      {
        "district": "Patna",
        "localities": [
          {
            "name": "Boring Road & Boring Canal Road",
            "pincode": "800001",
            "lat": 25.618,
            "lng": 85.122
          },
          {
            "name": "Kankarbagh & Colony",
            "pincode": "800020",
            "lat": 25.592,
            "lng": 85.155
          },
          {
            "name": "Bailey Road & Raja Bazar",
            "pincode": "800014",
            "lat": 25.612,
            "lng": 85.088
          },
          {
            "name": "Fraser Road & Dak Bungalow",
            "pincode": "800001",
            "lat": 25.608,
            "lng": 85.138
          }
        ]
      },
      {
        "district": "Ranchi",
        "localities": [
          {
            "name": "Main Road & Albert Ekka Chowk",
            "pincode": "834001",
            "lat": 23.368,
            "lng": 85.328
          },
          {
            "name": "Harmu Housing Colony",
            "pincode": "834002",
            "lat": 23.355,
            "lng": 85.305
          },
          {
            "name": "Lalpur & Circular Road",
            "pincode": "834001",
            "lat": 23.375,
            "lng": 85.335
          }
        ]
      }
    ]
  },
  {
    "state": "Kerala",
    "districts": [
      {
        "district": "Ernakulam (Kochi)",
        "localities": [
          {
            "name": "Marine Drive & MG Road Kochi",
            "pincode": "682011",
            "lat": 9.982,
            "lng": 76.275
          },
          {
            "name": "Kakkanad & Infopark SmartCity",
            "pincode": "682030",
            "lat": 10.012,
            "lng": 76.355
          },
          {
            "name": "Edappally (Lulu Mall)",
            "pincode": "682024",
            "lat": 10.025,
            "lng": 76.308
          },
          {
            "name": "Fort Kochi & Mattancherry",
            "pincode": "682001",
            "lat": 9.965,
            "lng": 76.242
          }
        ]
      },
      {
        "district": "Thiruvananthapuram",
        "localities": [
          {
            "name": "Kowdiar & Vellayambalam",
            "pincode": "695003",
            "lat": 8.525,
            "lng": 76.965
          },
          {
            "name": "Technopark Kazhakkoottam",
            "pincode": "695581",
            "lat": 8.558,
            "lng": 76.882
          }
        ]
      }
    ]
  },
  {
    "state": "Andhra Pradesh",
    "districts": [
      {
        "district": "Visakhapatnam",
        "localities": [
          {
            "name": "Dwaraka Nagar & Complex",
            "pincode": "530016",
            "lat": 17.728,
            "lng": 83.308
          },
          {
            "name": "Siripuram & Beach Road",
            "pincode": "530003",
            "lat": 17.721,
            "lng": 83.318
          },
          {
            "name": "Madhurawada IT SEZ",
            "pincode": "530048",
            "lat": 17.822,
            "lng": 83.355
          }
        ]
      },
      {
        "district": "Vijayawada",
        "localities": [
          {
            "name": "MG Road & Benz Circle",
            "pincode": "520010",
            "lat": 16.502,
            "lng": 80.648
          },
          {
            "name": "Governorpet & Suryaraopet",
            "pincode": "520002",
            "lat": 16.512,
            "lng": 80.628
          }
        ]
      }
    ]
  },
  {
    "state": "Odisha",
    "districts": [
      {
        "district": "Khordha (Bhubaneswar)",
        "localities": [
          {
            "name": "Saheed Nagar & Janpath",
            "pincode": "751007",
            "lat": 20.292,
            "lng": 85.845
          },
          {
            "name": "Patia & Infocity Chandrasekharpur",
            "pincode": "751024",
            "lat": 20.355,
            "lng": 85.818
          },
          {
            "name": "Nayapalli & Jaydev Vihar",
            "pincode": "751012",
            "lat": 20.301,
            "lng": 85.822
          }
        ]
      }
    ]
  },
  {
    "state": "Assam & North East",
    "districts": [
      {
        "district": "Kamrup Metropolitan (Guwahati)",
        "localities": [
          {
            "name": "GS Road & Christian Basti",
            "pincode": "781005",
            "lat": 26.155,
            "lng": 91.778
          },
          {
            "name": "Dispur & Ganeshguri",
            "pincode": "781006",
            "lat": 26.142,
            "lng": 91.792
          },
          {
            "name": "Paltan Bazar & Pan Bazar",
            "pincode": "781001",
            "lat": 26.182,
            "lng": 91.748
          }
        ]
      }
    ]
  },
  {
    "state": "Uttarakhand",
    "districts": [
      {
        "district": "Dehradun",
        "localities": [
          {
            "name": "Rajpur Road & Jakhan",
            "pincode": "248001",
            "lat": 30.342,
            "lng": 78.062
          },
          {
            "name": "Clock Tower & Paltan Bazaar",
            "pincode": "248001",
            "lat": 30.325,
            "lng": 78.042
          },
          {
            "name": "Vasant Vihar & Ballupur Chowk",
            "pincode": "248006",
            "lat": 30.332,
            "lng": 78.018
          }
        ]
      }
    ]
  },
  {
    "state": "Goa",
    "districts": [
      {
        "district": "North Goa",
        "localities": [
          {
            "name": "Panaji (Miramar / Campal / Fontainhas)",
            "pincode": "403001",
            "lat": 15.4989,
            "lng": 73.8278
          },
          {
            "name": "Candolim & Calangute Beach Road",
            "pincode": "403515",
            "lat": 15.518,
            "lng": 73.765
          },
          {
            "name": "Porvorim (Mall De Goa)",
            "pincode": "403521",
            "lat": 15.535,
            "lng": 73.832
          }
        ]
      },
      {
        "district": "South Goa",
        "localities": [
          {
            "name": "Margao (Colva Beach Road / Pajifond)",
            "pincode": "403601",
            "lat": 15.275,
            "lng": 73.962
          },
          {
            "name": "Vasco da Gama & Dabolim Airport",
            "pincode": "403802",
            "lat": 15.395,
            "lng": 73.825
          }
        ]
      }
    ]
  },
  {
    "state": "Jammu & Kashmir",
    "districts": [
      {
        "district": "Srinagar",
        "localities": [
          {
            "name": "Lal Chowk & Residency Road",
            "pincode": "190001",
            "lat": 34.072,
            "lng": 74.812
          },
          {
            "name": "Dal Lake & Boulevard Road",
            "pincode": "190001",
            "lat": 34.092,
            "lng": 74.845
          },
          {
            "name": "Rajbagh & Jawahar Nagar",
            "pincode": "190008",
            "lat": 34.062,
            "lng": 74.825
          }
        ]
      },
      {
        "district": "Jammu",
        "localities": [
          {
            "name": "Gandhi Nagar & Bahu Plaza",
            "pincode": "180004",
            "lat": 32.705,
            "lng": 74.868
          },
          {
            "name": "Raghunath Bazar & Old City",
            "pincode": "180001",
            "lat": 32.728,
            "lng": 74.862
          }
        ]
      }
    ]
  }
];
