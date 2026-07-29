'use strict';

const mongoose = require('mongoose');
const School = require('../src/models/school.model');
const config = require('../src/config');

// Connect to MongoDB using the same configuration as the application
mongoose.connect(config.mongo.uri || 'mongodb://localhost:27017/monkor', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const koreanSchools = [
  {
    name: 'Dong-eui University',
    nameInKorean: '동의대학교',
    description: 'A private university located in Busan, known for its programs in engineering, business, and health sciences.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Seoul Theological University',
    nameInKorean: '서울신학대학교',
    description: 'A private Christian university offering theological and liberal arts programs.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Ajou University',
    nameInKorean: '아주대학교',
    description: 'A private research university in Suwon, known for its engineering and business programs.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Chung-Ang University',
    nameInKorean: '중앙대학교',
    description: 'A private university in Seoul, known for its programs in arts, media, and business.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Dankook University',
    nameInKorean: '단국대학교',
    description: 'A private university with campuses in Seoul and Cheonan, offering diverse academic programs.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Dongguk University',
    nameInKorean: '동국대학교',
    description: 'A private Buddhist university in Seoul, known for its programs in humanities and social sciences.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Duksung Women\'s University',
    nameInKorean: '덕성여자대학교',
    description: 'A private women\'s university in Seoul, offering programs in liberal arts, sciences, and professional studies.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Ewha Womans University',
    nameInKorean: '이화여자대학교',
    description: 'Korea\'s most prestigious women\'s university, offering comprehensive academic programs.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: true,
    partnershipLevel: 'preferred'
  },
  {
    name: 'Hankuk University of Foreign Studies',
    nameInKorean: '한국외국어대학교',
    description: 'A leading university specializing in foreign languages and international studies.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: true,
    partnershipLevel: 'preferred'
  },
  {
    name: 'Hansung University',
    nameInKorean: '한성대학교',
    description: 'A private university in Seoul, known for its programs in engineering and business.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Hanyang University',
    nameInKorean: '한양대학교',
    description: 'A leading private university known for its strong engineering programs and practical education approach.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: true,
    partnershipLevel: 'preferred'
  },
  {
    name: 'Hongik University',
    nameInKorean: '홍익대학교',
    description: 'A private university in Seoul, renowned for its programs in art, design, and architecture.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'National University',
    nameInKorean: '국립대학교',
    description: 'A national university system offering various academic programs across Korea.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Inha University',
    nameInKorean: '인하대학교',
    description: 'A private university in Incheon, known for its engineering and business programs.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Konkuk University',
    nameInKorean: '건국대학교',
    description: 'A private university in Seoul, offering programs in agriculture, veterinary medicine, and other fields.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Kookmin University',
    nameInKorean: '국민대학교',
    description: 'A private university in Seoul, known for its programs in engineering, business, and design.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Korea University',
    nameInKorean: '고려대학교',
    description: 'One of Korea\'s oldest and most prestigious private universities, known for its strong programs in business, law, and medicine.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: true,
    partnershipLevel: 'exclusive'
  },
  {
    name: 'KyungHee University',
    nameInKorean: '경희대학교',
    description: 'A private university in Seoul, known for its programs in medicine, international studies, and hospitality.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: true,
    partnershipLevel: 'preferred'
  },
  {
    name: 'Myongji University',
    nameInKorean: '명지대학교',
    description: 'A private university with campuses in Seoul and Yongin, offering diverse academic programs.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Pohang University of Science and Technology (POSTECH)',
    nameInKorean: '포항공과대학교',
    description: 'A leading science and technology university known for its research excellence and small class sizes.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: true,
    partnershipLevel: 'exclusive'
  },
  {
    name: 'Seokyeong University',
    nameInKorean: '서경대학교',
    description: 'A private university in Seoul, offering programs in engineering, business, and liberal arts.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Seoul National University',
    nameInKorean: '서울대학교',
    description: 'Korea\'s most prestigious university, consistently ranked as the top university in Korea and among the best in Asia.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: true,
    partnershipLevel: 'exclusive'
  },
  {
    name: 'Seoul National University of Science and Technology',
    nameInKorean: '서울과학기술대학교',
    description: 'A national university specializing in science and technology education.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Shinhan University',
    nameInKorean: '신한대학교',
    description: 'A private university offering programs in business, engineering, and liberal arts.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Sogang University',
    nameInKorean: '서강대학교',
    description: 'A prestigious private university known for its strong programs in business, economics, and international studies.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: true,
    partnershipLevel: 'preferred'
  },
  {
    name: 'Sookmyung Women\'s University',
    nameInKorean: '숙명여자대학교',
    description: 'Korea\'s leading women\'s university, offering diverse programs with a focus on women\'s empowerment and leadership.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Sungkyunkwan University',
    nameInKorean: '성균관대학교',
    description: 'A prestigious private university with a long history, known for its programs in humanities, sciences, and engineering.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: true,
    partnershipLevel: 'preferred'
  },
  {
    name: 'Sungshin Women\'s University',
    nameInKorean: '성신여자대학교',
    description: 'A private women\'s university in Seoul, offering programs in liberal arts, sciences, and professional studies.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Tech University of Korea',
    nameInKorean: '한국기술교육대학교',
    description: 'A national university specializing in technology education and vocational training.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Ulsan National Institute of Science and Technology (UNIST)',
    nameInKorean: '울산과학기술원',
    description: 'A national research university in Ulsan, focusing on science and technology education and research.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: true,
    partnershipLevel: 'preferred'
  },
  {
    name: 'University of Seoul',
    nameInKorean: '서울시립대학교',
    description: 'A municipal university in Seoul, offering programs in various academic fields.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Yonsei University',
    nameInKorean: '연세대학교',
    description: 'A leading private research university in Seoul, known for its comprehensive academic programs and strong international presence.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: true,
    partnershipLevel: 'exclusive'
  },
  {
    name: 'Busan University of Foreign Studies',
    nameInKorean: '부산외국어대학교',
    description: 'A private university in Busan specializing in foreign languages and international studies.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Cheongju University',
    nameInKorean: '청주대학교',
    description: 'A private university in Cheongju, offering programs in various academic fields.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Chonnam National University',
    nameInKorean: '전남대학교',
    description: 'A national university in Gwangju, offering comprehensive academic programs.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Chosun University',
    nameInKorean: '조선대학교',
    description: 'A private university in Gwangju, known for its programs in engineering, medicine, and liberal arts.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Chungbuk National University',
    nameInKorean: '충북대학교',
    description: 'A national university in Cheongju, offering diverse academic programs.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Chungnam National University',
    nameInKorean: '충남대학교',
    description: 'A national university in Daejeon, known for its programs in agriculture, engineering, and sciences.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Daegu Catholic University',
    nameInKorean: '대구가톨릭대학교',
    description: 'A private Catholic university in Daegu, offering programs in theology, liberal arts, and sciences.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Daegu University',
    nameInKorean: '대구대학교',
    description: 'A private university in Daegu, offering programs in various academic fields.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Daejeon University',
    nameInKorean: '대전대학교',
    description: 'A private university in Daejeon, known for its programs in engineering and business.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Dong-A University',
    nameInKorean: '동아대학교',
    description: 'A private university in Busan, offering programs in medicine, engineering, and liberal arts.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Dongseo University',
    nameInKorean: '동서대학교',
    description: 'A private university in Busan, known for its programs in design, media, and international studies.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Gyeongkuk National University',
    nameInKorean: '경국대학교',
    description: 'A national university offering programs in various academic fields.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Gyeongsang National University',
    nameInKorean: '경상국립대학교',
    description: 'A national university in Jinju, offering comprehensive academic programs.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Hannam University',
    nameInKorean: '한남대학교',
    description: 'A private university in Daejeon, offering programs in engineering, business, and liberal arts.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Hoseo University',
    nameInKorean: '호서대학교',
    description: 'A private university in Asan, known for its programs in engineering and business.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Inje University',
    nameInKorean: '인제대학교',
    description: 'A private university in Gimhae, known for its programs in medicine and health sciences.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Jeju National University',
    nameInKorean: '제주대학교',
    description: 'A national university in Jeju, offering programs in various academic fields.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Jeonbuk National University',
    nameInKorean: '전북대학교',
    description: 'A national university in Jeonju, offering comprehensive academic programs.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Kangwon National University',
    nameInKorean: '강원대학교',
    description: 'A national university in Chuncheon, offering programs in various academic fields.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Keimyung University',
    nameInKorean: '계명대학교',
    description: 'A private university in Daegu, offering programs in medicine, engineering, and liberal arts.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Kongju National University',
    nameInKorean: '공주대학교',
    description: 'A national university in Gongju, offering programs in education, engineering, and liberal arts.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Konyang University',
    nameInKorean: '건양대학교',
    description: 'A private university in Daejeon, known for its programs in medicine and health sciences.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Korea Maritime & Ocean University',
    nameInKorean: '한국해양대학교',
    description: 'A national university in Busan, specializing in maritime and ocean engineering.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Korea University of Technology and Education (KOREATECH)',
    nameInKorean: '한국기술교육대학교',
    description: 'A national university specializing in technology education and vocational training.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Korea University Sejong Campus',
    nameInKorean: '고려대학교 세종캠퍼스',
    description: 'A branch campus of Korea University in Sejong, offering programs in various academic fields.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: true,
    partnershipLevel: 'preferred'
  },
  {
    name: 'Kunsan National University',
    nameInKorean: '군산대학교',
    description: 'A national university in Gunsan, offering programs in various academic fields.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Kyungpook National University',
    nameInKorean: '경북대학교',
    description: 'A national university in Daegu, offering comprehensive academic programs.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Kyungsung University',
    nameInKorean: '경성대학교',
    description: 'A private university in Busan, offering programs in various academic fields.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Mokwon University',
    nameInKorean: '목원대학교',
    description: 'A private university in Daejeon, offering programs in theology, liberal arts, and sciences.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Pai Chai University',
    nameInKorean: '배재대학교',
    description: 'A private university in Daejeon, offering programs in various academic fields.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Pukyong National University',
    nameInKorean: '부경대학교',
    description: 'A national university in Busan, offering programs in marine sciences, engineering, and liberal arts.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Pusan National University',
    nameInKorean: '부산대학교',
    description: 'A national university in Busan, offering comprehensive academic programs.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Semyung University',
    nameInKorean: '세명대학교',
    description: 'A private university in Jecheon, offering programs in various academic fields.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Silla University',
    nameInKorean: '신라대학교',
    description: 'A private university in Busan, offering programs in various academic fields.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Soonchunhyang University',
    nameInKorean: '순천향대학교',
    description: 'A private university in Asan, known for its programs in medicine and health sciences.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Sun Moon University',
    nameInKorean: '선문대학교',
    description: 'A private university in Asan, offering programs in various academic fields.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Sunchon National University',
    nameInKorean: '순천대학교',
    description: 'A national university in Suncheon, offering programs in various academic fields.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'University of Ulsan',
    nameInKorean: '울산대학교',
    description: 'A national university in Ulsan, offering programs in engineering, business, and liberal arts.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  },
  {
    name: 'Yeungnam University',
    nameInKorean: '영남대학교',
    description: 'A private university in Gyeongsan, offering programs in engineering, medicine, and liberal arts.',
    schoolType: 'university',
    categories: ['visa_required', 'guarantor_required'],
    status: 'active',
    isPartner: false,
    partnershipLevel: 'basic'
  }
];

async function seedKoreanSchools() {
  try {
    console.log('Clearing existing schools...');
    await School.deleteMany({});
    
    console.log('Creating Korean schools...');
    const schools = await School.insertMany(koreanSchools);
    
    console.log(`Successfully created ${schools.length} Korean schools:`);
    schools.forEach(school => {
      console.log(`- ${school.name} (${school.nameInKorean}) - ${school.schoolType} - Partner: ${school.isPartner ? 'Yes' : 'No'}`);
    });
    
    console.log('\nKorean schools data seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding Korean schools data:', error);
    process.exit(1);
  }
}

seedKoreanSchools();