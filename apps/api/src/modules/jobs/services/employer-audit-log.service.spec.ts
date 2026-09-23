import { EmployerAuditLogService } from './employer-audit-log.service';

describe('EmployerAuditLogService', () => {
  let service: EmployerAuditLogService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      employerAuditLog: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    };
    service = new EmployerAuditLogService(prisma);
  });

  describe('record', () => {
    it('creates a row with the given fields', async () => {
      prisma.employerAuditLog.create.mockResolvedValue({ id: 'log-1' });
      await service.record({ employerId: 'employer-1', actorId: 'user-1', action: 'employer.registered' });
      expect(prisma.employerAuditLog.create).toHaveBeenCalledWith({
        data: { employerId: 'employer-1', actorId: 'user-1', action: 'employer.registered', note: null },
      });
    });

    it('allows a null employerId for platform-wide events', async () => {
      prisma.employerAuditLog.create.mockResolvedValue({ id: 'log-2' });
      await service.record({ employerId: null, actorId: 'admin-1', action: 'platform_setting.updated' });
      expect(prisma.employerAuditLog.create).toHaveBeenCalledWith({
        data: { employerId: null, actorId: 'admin-1', action: 'platform_setting.updated', note: null },
      });
    });

    it('truncates an overlong note to 2000 characters', async () => {
      prisma.employerAuditLog.create.mockResolvedValue({});
      const longNote = 'x'.repeat(3000);
      await service.record({ employerId: 'employer-1', action: 'test', note: longNote });
      const data = prisma.employerAuditLog.create.mock.calls[0][0].data;
      expect(data.note).toHaveLength(2000);
    });
  });

  describe('listForEmployer', () => {
    it('paginates and orders newest-first', async () => {
      prisma.employerAuditLog.findMany.mockResolvedValue([{ id: 'log-1' }]);
      prisma.employerAuditLog.count.mockResolvedValue(1);
      const result = await service.listForEmployer('employer-1', 1, 10);
      expect(prisma.employerAuditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { employerId: 'employer-1' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      }));
      expect(result).toEqual({ data: [{ id: 'log-1' }], meta: { page: 1, limit: 10, total: 1, totalPages: 1 } });
    });
  });
});
