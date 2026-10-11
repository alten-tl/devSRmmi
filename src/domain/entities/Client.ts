import { Name } from '../value-objects/Name';
import { Address } from '../value-objects/Address';
import { Timezone } from '../value-objects/Timezone';
import type { ClientRow, ClientDto } from '../../types';

export interface ClientProps {
  id: string;
  name: Name;
  timezone: Timezone;
  address: Address;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateClientProps {
  name: string;
  timezone: string;
  address: string;
}

/**
 * Client domain entity. Encapsulates invariants and exposes an immutable API
 * (every update returns a new instance).
 */
export class Client {
  private readonly props: ClientProps;

  private constructor(props: ClientProps) {
    this.props = props;
  }

  public static create(input: CreateClientProps): Client {
    const now = new Date();
    return new Client({
      id: '',
      name: Name.create(input.name),
      timezone: Timezone.create(input.timezone),
      address: Address.create(input.address),
      createdAt: now,
      updatedAt: now,
    });
  }

  public static fromRow(row: ClientRow): Client {
    return new Client({
      id: row.id,
      name: Name.create(row.name),
      timezone: Timezone.create(row.timezone),
      address: Address.create(row.address),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  public get id(): string {
    return this.props.id;
  }
  public get name(): string {
    return this.props.name.value;
  }
  public get timezone(): string {
    return this.props.timezone.value;
  }
  public get address(): string {
    return this.props.address.value;
  }
  public get createdAt(): Date {
    return this.props.createdAt;
  }
  public get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public withIdentity(id: string): Client {
    return new Client({ ...this.props, id });
  }

  public toDto(): ClientDto {
    return {
      id: this.props.id,
      name: this.props.name.value,
      timezone: this.props.timezone.value,
      address: this.props.address.value,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }
}