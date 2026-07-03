export enum CashRegisterStatus {
  OPEN = 'aberto',
  CLOSED = 'fechado',
}

export enum YesNo {
  YES = 'S',
  NO = 'N',
}

export enum PaymentMethod {
  CARD = 1,
  BANK_DEPOSIT = 2,
  BANK_TRANSFER = 3,
  EXPRESS = 4,
  REFERENCE = 5,
  CASH = 6,
}

export enum AdminStatus {
  VALIDATED = 'validado',
  NOT_VALIDATED = 'nao validado',
  PENDING = 'pendente',
}

export enum FinalStatus {
  CLOSED = 'fechado',
  PENDING = 'pendente',
  COMPLETE = 'concluido',
}
