import { PartialType } from '@nestjs/mapped-types';
import { CreateBullDto } from './create-bull.dto';

export class UpdateBullDto extends PartialType(CreateBullDto) {}
