import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from './entities/team.entity';

@Injectable()
export class TeamService {
    constructor(
        @InjectRepository(Team)
        private readonly teamRepository: Repository<Team>,
    ) { }

    async findAll(): Promise<Team[]> {
        return await this.teamRepository.find({
            order: { order: 'ASC' },
        });
    }

    async findByGroup(group: string): Promise<Team[]> {
        return await this.teamRepository.find({
            where: { group },
            order: { order: 'ASC' },
        });
    }

    async findById(id: string): Promise<Team | null> {
        return await this.teamRepository.findOne({ where: { id } });
    }
}