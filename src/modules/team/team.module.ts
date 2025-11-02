import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamService } from './team.service';
import { Team } from './entities/team.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Team])],
    providers: [TeamService],
    exports: [TeamService],
})
export class TeamModule { }