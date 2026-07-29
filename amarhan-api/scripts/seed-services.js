'use strict';

const mongoose = require('mongoose');
const Service = require('../src/models/service.model');
const config = require('../src/config');

// Connect to MongoDB using the same configuration as the application
mongoose.connect(config.mongo.uri || 'mongodb://localhost:27017/monkor', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const services = [
  {
    name: 'Korean Government Scholarship Program (KGSP)',
    nameInMongolian: 'БНСУ-ын засгийн газрын тэтгэлэгт зуучлах',
    description: 'Comprehensive support for applying to Korean Government Scholarship Program including document preparation, application guidance, and interview preparation.',
    serviceType: 'government_scholarship',
    details: {
      duration: '6-12 months',
      process: [
        {
          step: 1,
          title: 'Initial Consultation',
          description: 'Assess eligibility and requirements',
          estimatedTime: '1 week'
        },
        {
          step: 2,
          title: 'Document Preparation',
          description: 'Prepare all required documents',
          estimatedTime: '2-4 weeks'
        },
        {
          step: 3,
          title: 'Application Submission',
          description: 'Submit application to Korean Embassy',
          estimatedTime: '1 week'
        },
        {
          step: 4,
          title: 'Interview Preparation',
          description: 'Prepare for embassy interview',
          estimatedTime: '2 weeks'
        }
      ],
      requirements: [
        'High school diploma or equivalent',
        'TOPIK Level 3 or higher',
        'Age under 25',
        'GPA 3.0 or higher',
        'Medical certificate',
        'Police clearance certificate'
      ],
      benefits: [
        'Full tuition coverage',
        'Monthly stipend (900,000 KRW)',
        'Airfare coverage',
        'Korean language course',
        'Health insurance',
        'Settlement allowance'
      ],
      fees: {
        consultation: 500000,
        application: 200000,
        processing: 300000,
        currency: 'MNT'
      }
    },
    eligibility: {
      ageRange: {
        min: 17,
        max: 25
      },
      educationLevel: ['high_school', 'bachelor'],
      languageRequirements: [
        {
          test: 'TOPIK',
          minimumLevel: 'Level 3'
        }
      ],
      gpaRequirement: {
        min: 3.0,
        max: 4.0
      }
    },
    applicationTimeline: {
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-03-31'),
      documentDeadline: new Date('2024-03-15'),
      interviewDate: new Date('2024-04-15'),
      resultDate: new Date('2024-05-31')
    },
    status: 'active',
    statistics: {
      totalApplications: 45,
      successfulApplications: 12,
      successRate: 26.7
    }
  },
  {
    name: 'Korean Language Preparation Program',
    nameInMongolian: 'Солонгос хэлний бэлтгэлд зуучлах',
    description: 'Comprehensive Korean language preparation program including TOPIK preparation, conversation practice, and cultural orientation.',
    serviceType: 'language_preparation',
    details: {
      duration: '3-6 months',
      process: [
        {
          step: 1,
          title: 'Language Assessment',
          description: 'Evaluate current Korean language level',
          estimatedTime: '1 day'
        },
        {
          step: 2,
          title: 'Study Plan Creation',
          description: 'Create personalized study plan',
          estimatedTime: '1 week'
        },
        {
          step: 3,
          title: 'Intensive Training',
          description: 'Daily Korean language classes',
          estimatedTime: '3-6 months'
        },
        {
          step: 4,
          title: 'TOPIK Preparation',
          description: 'Focused TOPIK exam preparation',
          estimatedTime: '1 month'
        }
      ],
      requirements: [
        'Basic Korean language knowledge',
        'Commitment to daily study',
        'TOPIK Level 1 or higher preferred'
      ],
      benefits: [
        'Native Korean teachers',
        'Small class sizes (max 8 students)',
        'Cultural activities',
        'TOPIK exam preparation',
        'Study materials included',
        'Progress tracking'
      ],
      fees: {
        consultation: 200000,
        application: 100000,
        processing: 150000,
        currency: 'MNT'
      }
    },
    eligibility: {
      ageRange: {
        min: 16,
        max: 35
      },
      educationLevel: ['high_school', 'bachelor', 'master'],
      languageRequirements: [
        {
          test: 'TOPIK',
          minimumLevel: 'Level 1'
        }
      ]
    },
    applicationTimeline: {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      documentDeadline: new Date('2024-12-15'),
      interviewDate: new Date('2024-12-20'),
      resultDate: new Date('2024-12-25')
    },
    status: 'active',
    statistics: {
      totalApplications: 78,
      successfulApplications: 65,
      successRate: 83.3
    }
  },
  {
    name: 'Bachelor Degree Programs',
    nameInMongolian: 'Бакалаврын сургалт зуучлах',
    description: 'Comprehensive support for applying to Korean universities for bachelor degree programs including major selection, application guidance, and visa assistance.',
    serviceType: 'degree_programs',
    details: {
      duration: '4 years',
      process: [
        {
          step: 1,
          title: 'University Selection',
          description: 'Help select suitable universities and majors',
          estimatedTime: '2 weeks'
        },
        {
          step: 2,
          title: 'Document Preparation',
          description: 'Prepare all required application documents',
          estimatedTime: '3-4 weeks'
        },
        {
          step: 3,
          title: 'Application Submission',
          description: 'Submit applications to selected universities',
          estimatedTime: '1 week'
        },
        {
          step: 4,
          title: 'Interview Preparation',
          description: 'Prepare for university interviews',
          estimatedTime: '2 weeks'
        },
        {
          step: 5,
          title: 'Visa Application',
          description: 'Assist with student visa application',
          estimatedTime: '2-3 weeks'
        }
      ],
      requirements: [
        'High school diploma',
        'TOPIK Level 3 or higher',
        'GPA 3.0 or higher',
        'Financial proof',
        'Medical certificate',
        'Police clearance certificate'
      ],
      benefits: [
        'University selection guidance',
        'Document preparation assistance',
        'Application fee coverage (up to 3 universities)',
        'Interview preparation',
        'Visa application support',
        'Pre-departure orientation'
      ],
      fees: {
        consultation: 300000,
        application: 500000,
        processing: 400000,
        currency: 'MNT'
      }
    },
    eligibility: {
      ageRange: {
        min: 17,
        max: 25
      },
      educationLevel: ['high_school'],
      languageRequirements: [
        {
          test: 'TOPIK',
          minimumLevel: 'Level 3'
        }
      ],
      gpaRequirement: {
        min: 3.0,
        max: 4.0
      }
    },
    applicationTimeline: {
      startDate: new Date('2024-09-01'),
      endDate: new Date('2024-11-30'),
      documentDeadline: new Date('2024-11-15'),
      interviewDate: new Date('2024-12-01'),
      resultDate: new Date('2024-12-31')
    },
    status: 'active',
    statistics: {
      totalApplications: 32,
      successfulApplications: 18,
      successRate: 56.3
    }
  },
  {
    name: 'Master Degree Programs',
    nameInMongolian: 'Магистрын сургалт зуучлах',
    description: 'Specialized support for applying to Korean universities for master degree programs including research proposal guidance and scholarship applications.',
    serviceType: 'degree_programs',
    details: {
      duration: '2 years',
      process: [
        {
          step: 1,
          title: 'Research Area Selection',
          description: 'Help select research area and potential supervisors',
          estimatedTime: '2 weeks'
        },
        {
          step: 2,
          title: 'Research Proposal',
          description: 'Assist with research proposal writing',
          estimatedTime: '3-4 weeks'
        },
        {
          step: 3,
          title: 'Document Preparation',
          description: 'Prepare all required application documents',
          estimatedTime: '2-3 weeks'
        },
        {
          step: 4,
          title: 'Application Submission',
          description: 'Submit applications to selected universities',
          estimatedTime: '1 week'
        },
        {
          step: 5,
          title: 'Interview Preparation',
          description: 'Prepare for academic interviews',
          estimatedTime: '2 weeks'
        }
      ],
      requirements: [
        'Bachelor degree',
        'TOPIK Level 4 or higher',
        'GPA 3.5 or higher',
        'Research proposal',
        'Recommendation letters',
        'English proficiency (TOEFL/IELTS)'
      ],
      benefits: [
        'Research area guidance',
        'Proposal writing assistance',
        'Supervisor matching',
        'Scholarship application support',
        'Academic interview preparation',
        'Research methodology training'
      ],
      fees: {
        consultation: 400000,
        application: 600000,
        processing: 500000,
        currency: 'MNT'
      }
    },
    eligibility: {
      ageRange: {
        min: 22,
        max: 35
      },
      educationLevel: ['bachelor'],
      languageRequirements: [
        {
          test: 'TOPIK',
          minimumLevel: 'Level 4'
        },
        {
          test: 'TOEFL',
          minimumLevel: '80'
        }
      ],
      gpaRequirement: {
        min: 3.5,
        max: 4.0
      }
    },
    applicationTimeline: {
      startDate: new Date('2024-03-01'),
      endDate: new Date('2024-05-31'),
      documentDeadline: new Date('2024-05-15'),
      interviewDate: new Date('2024-06-15'),
      resultDate: new Date('2024-07-31')
    },
    status: 'active',
    statistics: {
      totalApplications: 15,
      successfulApplications: 8,
      successRate: 53.3
    }
  },
  {
    name: 'PhD Programs',
    nameInMongolian: 'Докторын сургалт зуучлах',
    description: 'Advanced support for applying to Korean universities for PhD programs including research proposal development and funding applications.',
    serviceType: 'degree_programs',
    details: {
      duration: '3-4 years',
      process: [
        {
          step: 1,
          title: 'Research Topic Development',
          description: 'Develop research topic and methodology',
          estimatedTime: '3-4 weeks'
        },
        {
          step: 2,
          title: 'Supervisor Matching',
          description: 'Find and contact potential supervisors',
          estimatedTime: '2-3 weeks'
        },
        {
          step: 3,
          title: 'Research Proposal',
          description: 'Write comprehensive research proposal',
          estimatedTime: '4-6 weeks'
        },
        {
          step: 4,
          title: 'Application Submission',
          description: 'Submit applications with funding requests',
          estimatedTime: '1 week'
        },
        {
          step: 5,
          title: 'Interview Preparation',
          description: 'Prepare for academic and funding interviews',
          estimatedTime: '3 weeks'
        }
      ],
      requirements: [
        'Master degree',
        'TOPIK Level 5 or higher',
        'GPA 3.7 or higher',
        'Research experience',
        'Publications preferred',
        'Strong recommendation letters'
      ],
      benefits: [
        'Research topic development',
        'Supervisor matching service',
        'Funding application support',
        'Publication guidance',
        'Academic networking',
        'Career development planning'
      ],
      fees: {
        consultation: 500000,
        application: 800000,
        processing: 600000,
        currency: 'MNT'
      }
    },
    eligibility: {
      ageRange: {
        min: 25,
        max: 40
      },
      educationLevel: ['master'],
      languageRequirements: [
        {
          test: 'TOPIK',
          minimumLevel: 'Level 5'
        },
        {
          test: 'TOEFL',
          minimumLevel: '90'
        }
      ],
      gpaRequirement: {
        min: 3.7,
        max: 4.0
      }
    },
    applicationTimeline: {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-03-31'),
      documentDeadline: new Date('2024-03-15'),
      interviewDate: new Date('2024-04-15'),
      resultDate: new Date('2024-05-31')
    },
    status: 'active',
    statistics: {
      totalApplications: 8,
      successfulApplications: 3,
      successRate: 37.5
    }
  }
];

async function seedServices() {
  try {
    console.log('Clearing existing services...');
    await Service.deleteMany({});
    
    console.log('Creating services...');
    const createdServices = await Service.insertMany(services);
    
    console.log(`Successfully created ${createdServices.length} services:`);
    createdServices.forEach(service => {
      console.log(`- ${service.name} (${service.serviceType}) - Success Rate: ${service.statistics.successRate}%`);
    });
    
    console.log('\nServices data seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding services data:', error);
    process.exit(1);
  }
}

seedServices();
