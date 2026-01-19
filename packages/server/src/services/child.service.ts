import { prisma } from '../config/database.js';
import { Role, InviteStatus } from '../types/enums.js';
import type {
  CreateChildInput,
  UpdateChildInput,
  ShareChildInput,
  ChildWithRole,
  ChildDetail,
  CaregiverInfo,
} from '../schemas/child.schema.js';

export class ChildServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'ChildServiceError';
  }
}

function formatChild(
  child: {
    id: string;
    name: string;
    birthDate: Date;
    photoUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  role: string
): ChildWithRole {
  return {
    id: child.id,
    name: child.name,
    birthDate: child.birthDate,
    photoUrl: child.photoUrl,
    role,
    createdAt: child.createdAt,
    updatedAt: child.updatedAt,
  };
}

export async function listChildren(userId: string): Promise<ChildWithRole[]> {
  const caregiverRelations = await prisma.childCaregiver.findMany({
    where: {
      userId,
      status: InviteStatus.ACCEPTED,
      isActive: true, // Only show children where access is active
    },
    include: {
      child: true,
    },
    orderBy: {
      child: {
        createdAt: 'desc',
      },
    },
  });

  return caregiverRelations.map((relation) =>
    formatChild(relation.child, relation.role)
  );
}

export async function createChild(
  userId: string,
  input: CreateChildInput
): Promise<ChildWithRole> {
  // Parse the date if it's a string
  const birthDate = typeof input.birthDate === 'string'
    ? new Date(input.birthDate)
    : input.birthDate;

  // Create child and caregiver relation in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const child = await tx.child.create({
      data: {
        name: input.name,
        birthDate,
        photoUrl: input.photoUrl,
      },
    });

    // Create caregiver relation with ADMIN role
    await tx.childCaregiver.create({
      data: {
        childId: child.id,
        userId,
        role: Role.ADMIN,
        status: InviteStatus.ACCEPTED,
        acceptedAt: new Date(),
        isActive: true,
      },
    });

    return child;
  });

  return formatChild(result, Role.ADMIN);
}

export async function getChild(
  userId: string,
  childId: string
): Promise<ChildDetail | null> {
  // Find the caregiver relation for this user
  const caregiverRelation = await prisma.childCaregiver.findUnique({
    where: {
      childId_userId: {
        childId,
        userId,
      },
    },
    include: {
      child: {
        include: {
          caregivers: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!caregiverRelation) {
    return null;
  }

  // Only show full details to accepted and active caregivers
  if (caregiverRelation.status !== InviteStatus.ACCEPTED || !caregiverRelation.isActive) {
    return null;
  }

  const child = caregiverRelation.child;
  const caregivers: CaregiverInfo[] = child.caregivers.map((cg) => ({
    id: cg.id,
    userId: cg.userId,
    email: cg.user.email,
    name: cg.user.name,
    role: cg.role,
    status: cg.status,
    title: cg.title,
    isActive: cg.isActive,
    invitedAt: cg.invitedAt,
    acceptedAt: cg.acceptedAt,
  }));

  return {
    id: child.id,
    name: child.name,
    birthDate: child.birthDate,
    photoUrl: child.photoUrl,
    role: caregiverRelation.role,
    createdAt: child.createdAt,
    updatedAt: child.updatedAt,
    caregivers,
  };
}

export async function updateChild(
  userId: string,
  childId: string,
  input: UpdateChildInput
): Promise<ChildWithRole> {
  // Check if user has ADMIN role for this child
  const caregiverRelation = await prisma.childCaregiver.findUnique({
    where: {
      childId_userId: {
        childId,
        userId,
      },
    },
  });

  if (!caregiverRelation) {
    throw new ChildServiceError(
      'Child not found',
      'CHILD_NOT_FOUND',
      404
    );
  }

  if (caregiverRelation.role !== Role.ADMIN) {
    throw new ChildServiceError(
      'Only admins can update child profiles',
      'FORBIDDEN',
      403
    );
  }

  // Build update data
  const updateData: {
    name?: string;
    birthDate?: Date;
    photoUrl?: string | null;
  } = {};

  if (input.name !== undefined) {
    updateData.name = input.name;
  }

  if (input.birthDate !== undefined) {
    updateData.birthDate = typeof input.birthDate === 'string'
      ? new Date(input.birthDate)
      : input.birthDate;
  }

  if (input.photoUrl !== undefined) {
    updateData.photoUrl = input.photoUrl;
  }

  const child = await prisma.child.update({
    where: { id: childId },
    data: updateData,
  });

  return formatChild(child, caregiverRelation.role);
}

export async function deleteChild(
  userId: string,
  childId: string
): Promise<void> {
  // Check if user has ADMIN role for this child
  const caregiverRelation = await prisma.childCaregiver.findUnique({
    where: {
      childId_userId: {
        childId,
        userId,
      },
    },
  });

  if (!caregiverRelation) {
    throw new ChildServiceError(
      'Child not found',
      'CHILD_NOT_FOUND',
      404
    );
  }

  if (caregiverRelation.role !== Role.ADMIN) {
    throw new ChildServiceError(
      'Only admins can delete child profiles',
      'FORBIDDEN',
      403
    );
  }

  // Delete child - cascade will handle related records
  await prisma.child.delete({
    where: { id: childId },
  });
}

export async function shareChild(
  userId: string,
  childId: string,
  input: ShareChildInput
): Promise<CaregiverInfo> {
  // Check if user has ADMIN role for this child
  const adminRelation = await prisma.childCaregiver.findUnique({
    where: {
      childId_userId: {
        childId,
        userId,
      },
    },
  });

  if (!adminRelation) {
    throw new ChildServiceError(
      'Child not found',
      'CHILD_NOT_FOUND',
      404
    );
  }

  if (adminRelation.role !== Role.ADMIN) {
    throw new ChildServiceError(
      'Only admins can share child profiles',
      'FORBIDDEN',
      403
    );
  }

  // Find the user to add - support both userId and email
  let targetUser;
  if (input.userId) {
    targetUser = await prisma.user.findUnique({
      where: { id: input.userId },
    });
  } else if (input.email) {
    targetUser = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
  }

  if (!targetUser) {
    throw new ChildServiceError(
      'User not found',
      'USER_NOT_FOUND',
      404
    );
  }

  // Cannot add yourself
  if (targetUser.id === userId) {
    throw new ChildServiceError(
      'Cannot add yourself as a caregiver',
      'CANNOT_ADD_SELF',
      400
    );
  }

  // Check if user is already a caregiver
  const existingRelation = await prisma.childCaregiver.findUnique({
    where: {
      childId_userId: {
        childId,
        userId: targetUser.id,
      },
    },
  });

  if (existingRelation) {
    throw new ChildServiceError(
      'User is already a caregiver for this child',
      'ALREADY_CAREGIVER',
      409
    );
  }

  // Create caregiver with immediate access (ACCEPTED status)
  const caregiver = await prisma.childCaregiver.create({
    data: {
      childId,
      userId: targetUser.id,
      role: input.role,
      status: InviteStatus.ACCEPTED,
      acceptedAt: new Date(),
      isActive: true,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  return {
    id: caregiver.id,
    userId: caregiver.userId,
    email: caregiver.user.email,
    name: caregiver.user.name,
    role: caregiver.role,
    status: caregiver.status,
    title: caregiver.title,
    isActive: caregiver.isActive,
    invitedAt: caregiver.invitedAt,
    acceptedAt: caregiver.acceptedAt,
  };
}

export async function removeCaregiver(
  userId: string,
  childId: string,
  caregiverUserId: string
): Promise<void> {
  // Check if user has ADMIN role for this child
  const adminRelation = await prisma.childCaregiver.findUnique({
    where: {
      childId_userId: {
        childId,
        userId,
      },
    },
  });

  if (!adminRelation) {
    throw new ChildServiceError(
      'Child not found',
      'CHILD_NOT_FOUND',
      404
    );
  }

  if (adminRelation.role !== Role.ADMIN) {
    throw new ChildServiceError(
      'Only admins can remove caregivers',
      'FORBIDDEN',
      403
    );
  }

  // Cannot remove self (there must be at least one admin)
  if (caregiverUserId === userId) {
    throw new ChildServiceError(
      'Cannot remove yourself as admin',
      'CANNOT_REMOVE_SELF',
      400
    );
  }

  // Find the caregiver to remove
  const caregiverRelation = await prisma.childCaregiver.findUnique({
    where: {
      childId_userId: {
        childId,
        userId: caregiverUserId,
      },
    },
  });

  if (!caregiverRelation) {
    throw new ChildServiceError(
      'Caregiver not found',
      'CAREGIVER_NOT_FOUND',
      404
    );
  }

  await prisma.childCaregiver.delete({
    where: { id: caregiverRelation.id },
  });
}

export async function acceptInvitation(
  userId: string,
  childId: string
): Promise<ChildWithRole> {
  // Find the pending invitation
  const invitation = await prisma.childCaregiver.findUnique({
    where: {
      childId_userId: {
        childId,
        userId,
      },
    },
    include: {
      child: true,
    },
  });

  if (!invitation) {
    throw new ChildServiceError(
      'Invitation not found',
      'INVITATION_NOT_FOUND',
      404
    );
  }

  if (invitation.status === InviteStatus.ACCEPTED) {
    throw new ChildServiceError(
      'Invitation already accepted',
      'ALREADY_ACCEPTED',
      400
    );
  }

  if (invitation.status === InviteStatus.DECLINED) {
    throw new ChildServiceError(
      'Invitation was declined',
      'INVITATION_DECLINED',
      400
    );
  }

  // Accept the invitation
  await prisma.childCaregiver.update({
    where: { id: invitation.id },
    data: {
      status: InviteStatus.ACCEPTED,
      acceptedAt: new Date(),
    },
  });

  return formatChild(invitation.child, invitation.role);
}

export async function declineInvitation(
  userId: string,
  childId: string
): Promise<void> {
  // Find the pending invitation
  const invitation = await prisma.childCaregiver.findUnique({
    where: {
      childId_userId: {
        childId,
        userId,
      },
    },
  });

  if (!invitation) {
    throw new ChildServiceError(
      'Invitation not found',
      'INVITATION_NOT_FOUND',
      404
    );
  }

  if (invitation.status !== InviteStatus.PENDING) {
    throw new ChildServiceError(
      'Can only decline pending invitations',
      'INVALID_STATUS',
      400
    );
  }

  // Delete the invitation
  await prisma.childCaregiver.delete({
    where: { id: invitation.id },
  });
}

export async function getPendingInvitations(
  userId: string
): Promise<Array<{
  id: string;
  child: {
    id: string;
    name: string;
  };
  role: string;
  invitedAt: Date;
}>> {
  const invitations = await prisma.childCaregiver.findMany({
    where: {
      userId,
      status: InviteStatus.PENDING,
    },
    include: {
      child: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      invitedAt: 'desc',
    },
  });

  return invitations.map((inv) => ({
    id: inv.id,
    child: inv.child,
    role: inv.role,
    invitedAt: inv.invitedAt,
  }));
}

export async function getUserRole(
  userId: string,
  childId: string
): Promise<string | null> {
  const relation = await prisma.childCaregiver.findUnique({
    where: {
      childId_userId: {
        childId,
        userId,
      },
    },
  });

  if (!relation || relation.status !== InviteStatus.ACCEPTED || !relation.isActive) {
    return null;
  }

  return relation.role;
}

// Toggle caregiver access (enable/disable)
export async function toggleCaregiverAccess(
  adminUserId: string,
  childId: string,
  caregiverUserId: string,
  isActive: boolean
): Promise<CaregiverInfo> {
  // Check if user has ADMIN role for this child
  const adminRelation = await prisma.childCaregiver.findUnique({
    where: {
      childId_userId: {
        childId,
        userId: adminUserId,
      },
    },
  });

  if (!adminRelation) {
    throw new ChildServiceError(
      'Child not found',
      'CHILD_NOT_FOUND',
      404
    );
  }

  if (adminRelation.role !== Role.ADMIN) {
    throw new ChildServiceError(
      'Only admins can toggle caregiver access',
      'FORBIDDEN',
      403
    );
  }

  // Cannot disable yourself
  if (caregiverUserId === adminUserId) {
    throw new ChildServiceError(
      'Cannot disable your own access',
      'CANNOT_MODIFY_SELF',
      400
    );
  }

  // Find the caregiver
  const caregiverRelation = await prisma.childCaregiver.findUnique({
    where: {
      childId_userId: {
        childId,
        userId: caregiverUserId,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (!caregiverRelation) {
    throw new ChildServiceError(
      'Caregiver not found',
      'CAREGIVER_NOT_FOUND',
      404
    );
  }

  // Update the access
  const updated = await prisma.childCaregiver.update({
    where: { id: caregiverRelation.id },
    data: {
      isActive,
      accessChangedAt: new Date(),
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  return {
    id: updated.id,
    userId: updated.userId,
    email: updated.user.email,
    name: updated.user.name,
    role: updated.role,
    status: updated.status,
    title: updated.title,
    isActive: updated.isActive,
    invitedAt: updated.invitedAt,
    acceptedAt: updated.acceptedAt,
  };
}

// Update caregiver title
export async function updateCaregiverTitle(
  adminUserId: string,
  childId: string,
  caregiverUserId: string,
  title: string
): Promise<CaregiverInfo> {
  // Check if user has ADMIN role for this child
  const adminRelation = await prisma.childCaregiver.findUnique({
    where: {
      childId_userId: {
        childId,
        userId: adminUserId,
      },
    },
  });

  if (!adminRelation) {
    throw new ChildServiceError(
      'Child not found',
      'CHILD_NOT_FOUND',
      404
    );
  }

  if (adminRelation.role !== Role.ADMIN) {
    throw new ChildServiceError(
      'Only admins can update caregiver titles',
      'FORBIDDEN',
      403
    );
  }

  // Find the caregiver
  const caregiverRelation = await prisma.childCaregiver.findUnique({
    where: {
      childId_userId: {
        childId,
        userId: caregiverUserId,
      },
    },
  });

  if (!caregiverRelation) {
    throw new ChildServiceError(
      'Caregiver not found',
      'CAREGIVER_NOT_FOUND',
      404
    );
  }

  // Update the title
  const updated = await prisma.childCaregiver.update({
    where: { id: caregiverRelation.id },
    data: { title },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  return {
    id: updated.id,
    userId: updated.userId,
    email: updated.user.email,
    name: updated.user.name,
    role: updated.role,
    status: updated.status,
    title: updated.title,
    isActive: updated.isActive,
    invitedAt: updated.invitedAt,
    acceptedAt: updated.acceptedAt,
  };
}

// Update caregiver role (e.g., promote to ADMIN)
export async function updateCaregiverRole(
  adminUserId: string,
  childId: string,
  caregiverUserId: string,
  role: string
): Promise<CaregiverInfo> {
  // Check if user has ADMIN role for this child
  const adminRelation = await prisma.childCaregiver.findUnique({
    where: {
      childId_userId: {
        childId,
        userId: adminUserId,
      },
    },
  });

  if (!adminRelation) {
    throw new ChildServiceError(
      'Child not found',
      'CHILD_NOT_FOUND',
      404
    );
  }

  if (adminRelation.role !== Role.ADMIN) {
    throw new ChildServiceError(
      'Only admins can change caregiver roles',
      'FORBIDDEN',
      403
    );
  }

  // Cannot change your own role
  if (caregiverUserId === adminUserId) {
    throw new ChildServiceError(
      'Cannot change your own role',
      'CANNOT_MODIFY_SELF',
      400
    );
  }

  // Validate role
  if (![Role.ADMIN, Role.CAREGIVER, Role.VIEWER].includes(role as Role)) {
    throw new ChildServiceError(
      'Invalid role',
      'INVALID_ROLE',
      400
    );
  }

  // Find the caregiver
  const caregiverRelation = await prisma.childCaregiver.findUnique({
    where: {
      childId_userId: {
        childId,
        userId: caregiverUserId,
      },
    },
  });

  if (!caregiverRelation) {
    throw new ChildServiceError(
      'Caregiver not found',
      'CAREGIVER_NOT_FOUND',
      404
    );
  }

  // Update the role
  const updatedCaregiver = await prisma.childCaregiver.update({
    where: { id: caregiverRelation.id },
    data: { role },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  return {
    id: updatedCaregiver.id,
    userId: updatedCaregiver.userId,
    email: updatedCaregiver.user.email,
    name: updatedCaregiver.user.name,
    role: updatedCaregiver.role,
    status: updatedCaregiver.status,
    title: updatedCaregiver.title,
    isActive: updatedCaregiver.isActive,
    invitedAt: updatedCaregiver.invitedAt,
    acceptedAt: updatedCaregiver.acceptedAt,
  };
}
