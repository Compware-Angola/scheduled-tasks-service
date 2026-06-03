import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HistoryGradeJobService, type ScheduleOptions } from '../service/history_grade/history_service.service';

@ApiTags('History Grade Jobs — Correção de Dados Antigos')
@Controller('history-grade/jobs')
export class HistoryGradeJobController {
    constructor(private readonly jobService: HistoryGradeJobService) { }

    @Post('start')
    @ApiOperation({ summary: 'Executa o job de correção agora uma vez' })
    @ApiResponse({ status: 201, description: 'Job enfileirado com sucesso' })
    async start() {
        return this.jobService.startOnce();
    }

    @Post('schedule')
    @ApiOperation({ summary: 'Agenda o job com cron ou intervalo em ms' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                cron: {
                    type: 'string',
                    example: '0 6 * * *',
                    description: 'Expressão cron — se passado ignora everyMs',
                },
                everyMs: {
                    type: 'number',
                    example: 10000,
                    description: 'Intervalo em milissegundos (default: 10000 = 10s)',
                },
            },
        },
    })
    @ApiResponse({ status: 201, description: 'Job agendado com sucesso' })
    async schedule(@Body() body: ScheduleOptions) {
        return this.jobService.scheduleJob(body);
    }

    @Delete('schedule/stop')
    @ApiOperation({ summary: 'Para o job agendado — passar o mesmo cron ou everyMs usado ao agendar' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                cron: { type: 'string', example: '0 6 * * *' },
                everyMs: { type: 'number', example: 10000 },
            },
        },
    })
    @ApiResponse({ status: 200, description: 'Agendamento removido' })
    async stopSchedule(@Body() body: ScheduleOptions) {
        return this.jobService.stopScheduled(body);
    }

    @Delete('clear/:status')
    @ApiOperation({ summary: 'Limpa jobs da fila por status' })
    @ApiParam({
        name: 'status',
        enum: ['completed', 'failed', 'wait', 'active', 'delayed'],
    })
    async clear(
        @Param('status') status: 'completed' | 'failed' | 'wait' | 'active' | 'delayed',
    ) {
        return this.jobService.clearQueue(status);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Remove um job específico pelo ID' })
    @ApiParam({ name: 'id', type: 'string' })
    async remove(@Param('id') id: string) {
        return this.jobService.removeJob(id);
    }

    @Get('status')
    @ApiOperation({ summary: 'Status geral da fila' })
    async status() {
        return this.jobService.getQueueStatus();
    }

    @Get('scheduled')
    @ApiOperation({ summary: 'Lista todos os jobs agendados' })
    async listScheduled() {
        return this.jobService.listScheduled();
    }
}