import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HistoryGradeJobService } from '../service/history_grade/history_service.service';

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
    @ApiOperation({ summary: 'Agenda o job para rodar todos os dias num horário' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                cron: {
                    type: 'string',
                    example: '0 6 * * *',
                    description: 'Expressão cron (default: 06:00 todos os dias)',
                },
            },
        },
    })
    @ApiResponse({ status: 201, description: 'Job agendado com sucesso' })
    async schedule(@Body() body: { cron?: string }) {
        return this.jobService.scheduleDaily(body.cron);
    }

    @Delete('schedule/stop')
    @ApiOperation({ summary: 'Para o job agendado' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                cron: {
                    type: 'string',
                    example: '0 6 * * *',
                    description: 'Deve ser o mesmo cron usado ao agendar',
                },
            },
        },
    })
    @ApiResponse({ status: 200, description: 'Agendamento removido' })
    async stopSchedule(@Body() body: { cron?: string }) {
        return this.jobService.stopScheduled(body.cron);
    }

    @Delete('clear/:status')
    @ApiOperation({ summary: 'Limpa jobs da fila por status' })
    @ApiParam({
        name: 'status',
        enum: ['completed', 'failed', 'wait', 'active', 'delayed'],
        description: 'Status dos jobs a limpar',
    })
    @ApiResponse({ status: 200, description: 'Fila limpa com sucesso' })
    async clear(
        @Param('status') status: 'completed' | 'failed' | 'wait' | 'active' | 'delayed',
    ) {
        return this.jobService.clearQueue(status);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Remove um job específico pelo ID' })
    @ApiParam({ name: 'id', type: 'string', description: 'ID do job' })
    @ApiResponse({ status: 200, description: 'Job removido' })
    @ApiResponse({ status: 404, description: 'Job não encontrado' })
    async remove(@Param('id') id: string) {
        return this.jobService.removeJob(id);
    }

    @Get('status')
    @ApiOperation({ summary: 'Retorna o status geral da fila' })
    @ApiResponse({
        status: 200,
        description: 'Contagens por estado da fila',
        schema: {
            example: {
                waiting: 0,
                active: 1,
                completed: 42,
                failed: 2,
                delayed: 0,
                repeatableJobs: [],
            },
        },
    })
    async status() {
        return this.jobService.getQueueStatus();
    }

    @Get('scheduled')
    @ApiOperation({ summary: 'Lista todos os jobs agendados (repeatable)' })
    @ApiResponse({ status: 200, description: 'Lista de jobs agendados' })
    async listScheduled() {
        return this.jobService.listScheduled();
    }
}