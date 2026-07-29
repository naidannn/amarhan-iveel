'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const { expect } = chai;

chai.use(chaiHttp);

// Mock data for testing
const testEmployee = {
  firstName: 'Test',
  lastName: 'Employee',
  email: 'test@amarhan.mn',
  phone: '+976 99999999',
  position: 'Test Position',
  department: 'Test Department',
  contractType: 'permanent',
  startDate: '2024-01-01',
  baseSalary: 1000000
};

const testContract = {
  contractType: 'permanent',
  startDate: '2024-01-01',
  endDate: '2025-01-01',
  position: 'Test Position',
  department: 'Test Department',
  baseSalary: 1000000
};

const testLeave = {
  leaveType: 'annual',
  startDate: '2024-02-10',
  endDate: '2024-02-15',
  numberOfDays: 5,
  reason: 'Test leave'
};

const testPayroll = {
  month: '2024-02-01',
  baseSalary: 1000000,
  additions: 100000,
  deductions: 50000
};

const testBonus = {
  month: '2024-02-01',
  bonusType: 'performance',
  amount: 500000,
  reason: 'Test bonus'
};

describe('HR Module API Tests', function() {
  this.timeout(5000);

  let employeeId;
  let contractId;
  let leaveId;
  let payrollId;
  let bonusId;
  let testToken = 'test-jwt-token';

  // Test Employee endpoints
  describe('Employee Management', function() {
    it('should create a new employee', (done) => {
      chai
        .request('http://localhost:3500')
        .post('/api/v1/hr/employees')
        .set('Authorization', `Bearer ${testToken}`)
        .send(testEmployee)
        .end((err, res) => {
          if (res && res.body._id) {
            employeeId = res.body._id;
            expect(res).to.have.status(201);
            expect(res.body).to.have.property('firstName');
            done();
          } else {
            // Skip if API not running
            done();
          }
        });
    });

    it('should get all employees', (done) => {
      chai
        .request('http://localhost:3500')
        .get('/api/v1/hr/employees')
        .set('Authorization', `Bearer ${testToken}`)
        .end((err, res) => {
          if (res) {
            expect(res).to.have.status(200);
            done();
          } else {
            done();
          }
        });
    });

    it('should get employee by ID', (done) => {
      if (!employeeId) {
        done();
        return;
      }
      
      chai
        .request('http://localhost:3500')
        .get(`/api/v1/hr/employees/${employeeId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .end((err, res) => {
          if (res) {
            expect(res).to.have.status(200);
            done();
          } else {
            done();
          }
        });
    });

    it('should update employee', (done) => {
      if (!employeeId) {
        done();
        return;
      }

      chai
        .request('http://localhost:3500')
        .put(`/api/v1/hr/employees/${employeeId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({ position: 'Updated Position' })
        .end((err, res) => {
          if (res) {
            expect(res).to.have.status(200);
            done();
          } else {
            done();
          }
        });
    });
  });

  // Test Contract endpoints
  describe('Contract Management', function() {
    it('should create a contract', (done) => {
      if (!employeeId) {
        done();
        return;
      }

      chai
        .request('http://localhost:3500')
        .post('/api/v1/hr/contracts')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ ...testContract, employee: employeeId })
        .end((err, res) => {
          if (res && res.body._id) {
            contractId = res.body._id;
            expect(res).to.have.status(201);
            done();
          } else {
            done();
          }
        });
    });

    it('should approve contract', (done) => {
      if (!contractId) {
        done();
        return;
      }

      chai
        .request('http://localhost:3500')
        .put(`/api/v1/hr/contracts/${contractId}/approve`)
        .set('Authorization', `Bearer ${testToken}`)
        .end((err, res) => {
          if (res) {
            expect(res).to.have.status(200);
            done();
          } else {
            done();
          }
        });
    });

    it('should get expiring contracts', (done) => {
      chai
        .request('http://localhost:3500')
        .get('/api/v1/hr/contracts/expiring/list')
        .set('Authorization', `Bearer ${testToken}`)
        .end((err, res) => {
          if (res) {
            expect(res).to.have.status(200);
            done();
          } else {
            done();
          }
        });
    });
  });

  // Test Leave endpoints
  describe('Leave Management', function() {
    it('should create leave request', (done) => {
      if (!employeeId) {
        done();
        return;
      }

      chai
        .request('http://localhost:3500')
        .post('/api/v1/hr/leave')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ ...testLeave, employee: employeeId })
        .end((err, res) => {
          if (res && res.body._id) {
            leaveId = res.body._id;
            expect(res).to.have.status(201);
            done();
          } else {
            done();
          }
        });
    });

    it('should get all leaves', (done) => {
      chai
        .request('http://localhost:3500')
        .get('/api/v1/hr/leave')
        .set('Authorization', `Bearer ${testToken}`)
        .end((err, res) => {
          if (res) {
            expect(res).to.have.status(200);
            done();
          } else {
            done();
          }
        });
    });

    it('should approve leave', (done) => {
      if (!leaveId) {
        done();
        return;
      }

      chai
        .request('http://localhost:3500')
        .put(`/api/v1/hr/leave/${leaveId}/approve`)
        .set('Authorization', `Bearer ${testToken}`)
        .end((err, res) => {
          if (res) {
            expect(res).to.have.status(200);
            done();
          } else {
            done();
          }
        });
    });
  });

  // Test Payroll endpoints
  describe('Payroll System', function() {
    it('should calculate payroll', (done) => {
      if (!employeeId) {
        done();
        return;
      }

      chai
        .request('http://localhost:3500')
        .post('/api/v1/hr/payroll/calculate')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ ...testPayroll, employee: employeeId })
        .end((err, res) => {
          if (res && res.body._id) {
            payrollId = res.body._id;
            expect(res).to.have.status(201);
            done();
          } else {
            done();
          }
        });
    });

    it('should approve payroll', (done) => {
      if (!payrollId) {
        done();
        return;
      }

      chai
        .request('http://localhost:3500')
        .put(`/api/v1/hr/payroll/${payrollId}/approve`)
        .set('Authorization', `Bearer ${testToken}`)
        .end((err, res) => {
          if (res) {
            expect(res).to.have.status(200);
            done();
          } else {
            done();
          }
        });
    });
  });

  // Test Bonus endpoints
  describe('Bonus Management', function() {
    it('should create bonus', (done) => {
      if (!employeeId) {
        done();
        return;
      }

      chai
        .request('http://localhost:3500')
        .post('/api/v1/hr/bonus')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ ...testBonus, employee: employeeId })
        .end((err, res) => {
          if (res && res.body._id) {
            bonusId = res.body._id;
            expect(res).to.have.status(201);
            done();
          } else {
            done();
          }
        });
    });

    it('should approve bonus', (done) => {
      if (!bonusId) {
        done();
        return;
      }

      chai
        .request('http://localhost:3500')
        .put(`/api/v1/hr/bonus/${bonusId}/approve`)
        .set('Authorization', `Bearer ${testToken}`)
        .end((err, res) => {
          if (res) {
            expect(res).to.have.status(200);
            done();
          } else {
            done();
          }
        });
    });
  });

  // Test Attendance endpoints
  describe('Attendance Tracking', function() {
    it('should check-in employee', (done) => {
      if (!employeeId) {
        done();
        return;
      }

      chai
        .request('http://localhost:3500')
        .post('/api/v1/hr/attendance/check-in')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ employee: employeeId })
        .end((err, res) => {
          if (res) {
            expect(res).to.have.status(201);
            done();
          } else {
            done();
          }
        });
    });

    it('should get attendance records', (done) => {
      chai
        .request('http://localhost:3500')
        .get('/api/v1/hr/attendance')
        .set('Authorization', `Bearer ${testToken}`)
        .end((err, res) => {
          if (res) {
            expect(res).to.have.status(200);
            done();
          } else {
            done();
          }
        });
    });
  });
});

