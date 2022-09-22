require File.expand_path('../../spec_helper', __FILE__)

module Pod
  describe Command::Plugin do
    describe 'CLAide' do
      it 'registers it self' do
        Command.parse(%w{ plugin }).should.be.instance_of Command::Plugin
      end
    end
  end
end

